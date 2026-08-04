use super::{PlateBoundaryKind, PlateField, PlateType};
use crate::{UnitDirectionQ30, DIRECTION_Q30_SCALE};

pub const GEOLOGICAL_POTENTIAL_SCALE: u32 = 1_000_000;
const GEOLOGICAL_BOUNDARY_MARGIN_Q60: i128 =
    (DIRECTION_Q30_SCALE as i128) * (DIRECTION_Q30_SCALE as i128) / 96;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Default)]
pub struct GeologicalPotentialSample {
    orogeny: u32,
    subduction: u32,
    spreading_ridge: u32,
    transform_fault: u32,
    volcanism: u32,
    seismicity: u32,
    trench: u32,
}

impl GeologicalPotentialSample {
    #[must_use]
    pub const fn orogeny(self) -> u32 {
        self.orogeny
    }

    #[must_use]
    pub const fn subduction(self) -> u32 {
        self.subduction
    }

    #[must_use]
    pub const fn spreading_ridge(self) -> u32 {
        self.spreading_ridge
    }

    #[must_use]
    pub const fn transform_fault(self) -> u32 {
        self.transform_fault
    }

    #[must_use]
    pub const fn volcanism(self) -> u32 {
        self.volcanism
    }

    #[must_use]
    pub const fn seismicity(self) -> u32 {
        self.seismicity
    }

    #[must_use]
    pub const fn trench(self) -> u32 {
        self.trench
    }

    #[must_use]
    pub const fn is_interior(self) -> bool {
        self.orogeny == 0
            && self.subduction == 0
            && self.spreading_ridge == 0
            && self.transform_fault == 0
            && self.volcanism == 0
            && self.seismicity == 0
            && self.trench == 0
    }
}

impl PlateField {
    /// Converts local plate-boundary kinematics and crust types into normalized
    /// geological-effect potentials.
    ///
    /// Each output channel is in `0..=GEOLOGICAL_POTENTIAL_SCALE` and can be
    /// consumed independently by terrain, hazard, and resource generators.
    ///
    /// # Panics
    ///
    /// Panics only if a `PlateField` is internally inconsistent and a boundary
    /// references a plate ID not present in the field. Public constructors keep
    /// these invariants valid.
    #[must_use]
    pub fn geological_potential_at(
        &self,
        direction: UnitDirectionQ30,
    ) -> GeologicalPotentialSample {
        let boundary = self.boundary_at(direction);
        if boundary.kind() == PlateBoundaryKind::Interior {
            return GeologicalPotentialSample::default();
        }

        let primary = self
            .plates()
            .iter()
            .find(|plate| plate.id() == boundary.primary_plate())
            .expect("boundary primary plate exists");
        let secondary = self
            .plates()
            .iter()
            .find(|plate| plate.id() == boundary.secondary_plate())
            .expect("boundary secondary plate exists");

        let proximity = boundary_proximity(boundary.ownership_margin_q60());
        let normal_strength = score_strength(boundary.normal_motion_score());
        let shear_strength = score_strength(boundary.shear_motion_score());
        let collision_strength = multiply_potential(proximity, normal_strength.max(125_000));
        let shear_effect = multiply_potential(proximity, shear_strength.max(125_000));
        let has_oceanic = primary.plate_type() == PlateType::Oceanic
            || secondary.plate_type() == PlateType::Oceanic;
        let both_continental = primary.plate_type() == PlateType::Continental
            && secondary.plate_type() == PlateType::Continental;

        match boundary.kind() {
            PlateBoundaryKind::Interior => GeologicalPotentialSample::default(),
            PlateBoundaryKind::Convergent => {
                let subduction = if has_oceanic { collision_strength } else { 0 };
                let orogeny = if both_continental {
                    collision_strength
                } else {
                    collision_strength / 2
                };
                GeologicalPotentialSample {
                    orogeny,
                    subduction,
                    spreading_ridge: 0,
                    transform_fault: 0,
                    volcanism: if has_oceanic {
                        collision_strength.saturating_mul(3) / 4
                    } else {
                        collision_strength / 5
                    },
                    seismicity: collision_strength,
                    trench: subduction,
                }
            }
            PlateBoundaryKind::Divergent => GeologicalPotentialSample {
                orogeny: 0,
                subduction: 0,
                spreading_ridge: collision_strength,
                transform_fault: 0,
                volcanism: collision_strength.saturating_mul(4) / 5,
                seismicity: collision_strength / 3,
                trench: 0,
            },
            PlateBoundaryKind::Transform => GeologicalPotentialSample {
                orogeny: 0,
                subduction: 0,
                spreading_ridge: 0,
                transform_fault: shear_effect,
                volcanism: 0,
                seismicity: shear_effect,
                trench: 0,
            },
        }
    }
}

fn boundary_proximity(ownership_margin_q60: i128) -> u32 {
    if ownership_margin_q60 >= GEOLOGICAL_BOUNDARY_MARGIN_Q60 {
        return 0;
    }
    let remaining = GEOLOGICAL_BOUNDARY_MARGIN_Q60.saturating_sub(ownership_margin_q60.max(0));
    let scaled = remaining.saturating_mul(i128::from(GEOLOGICAL_POTENTIAL_SCALE))
        / GEOLOGICAL_BOUNDARY_MARGIN_Q60;
    u32::try_from(scaled).unwrap_or(GEOLOGICAL_POTENTIAL_SCALE)
}

fn score_strength(score: i128) -> u32 {
    let scaled = score
        .abs()
        .saturating_div(i128::from(DIRECTION_Q30_SCALE).max(1));
    u32::try_from(scaled)
        .unwrap_or(GEOLOGICAL_POTENTIAL_SCALE)
        .min(GEOLOGICAL_POTENTIAL_SCALE)
}

fn multiply_potential(left: u32, right: u32) -> u32 {
    let product = u64::from(left) * u64::from(right);
    u32::try_from(product / u64::from(GEOLOGICAL_POTENTIAL_SCALE))
        .expect("normalized potential product fits u32")
}

#[cfg(test)]
mod tests {
    use super::{GeologicalPotentialSample, GEOLOGICAL_POTENTIAL_SCALE};
    use crate::tectonics::PlateField;

    #[test]
    fn plate_centers_have_no_boundary_geology() {
        let field = PlateField::earth_like(42);
        for plate in field.plates() {
            assert!(field.geological_potential_at(plate.center()).is_interior());
        }
    }

    #[test]
    fn geological_sampling_is_deterministic() {
        let field = PlateField::earth_like(77);
        for plate in field.plates() {
            assert_eq!(
                field.geological_potential_at(plate.center()),
                field.geological_potential_at(plate.center())
            );
        }
    }

    #[test]
    fn all_channels_are_normalized() {
        let field = PlateField::earth_like(9);
        for plate in field.plates() {
            let sample = field.geological_potential_at(plate.center());
            assert_normalized(sample);
        }
    }

    fn assert_normalized(sample: GeologicalPotentialSample) {
        assert!(sample.orogeny() <= GEOLOGICAL_POTENTIAL_SCALE);
        assert!(sample.subduction() <= GEOLOGICAL_POTENTIAL_SCALE);
        assert!(sample.spreading_ridge() <= GEOLOGICAL_POTENTIAL_SCALE);
        assert!(sample.transform_fault() <= GEOLOGICAL_POTENTIAL_SCALE);
        assert!(sample.volcanism() <= GEOLOGICAL_POTENTIAL_SCALE);
        assert!(sample.seismicity() <= GEOLOGICAL_POTENTIAL_SCALE);
        assert!(sample.trench() <= GEOLOGICAL_POTENTIAL_SCALE);
    }
}
