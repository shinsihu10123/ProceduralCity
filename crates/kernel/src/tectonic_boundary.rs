use crate::{PlateField, PlateId, TectonicPlate, UnitDirectionQ30, DIRECTION_Q30_SCALE};

const BOUNDARY_MARGIN_Q60: i128 =
    i128::from(DIRECTION_Q30_SCALE) * i128::from(DIRECTION_Q30_SCALE) / 96;
const NORMAL_MOTION_THRESHOLD: i128 = 1_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PlateBoundaryKind {
    Interior,
    Convergent,
    Divergent,
    Transform,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct PlateBoundarySample {
    primary_plate: PlateId,
    secondary_plate: PlateId,
    kind: PlateBoundaryKind,
    ownership_margin_q60: i128,
    normal_motion_score: i128,
    shear_motion_score: i128,
}

impl PlateBoundarySample {
    #[must_use]
    pub const fn primary_plate(self) -> PlateId {
        self.primary_plate
    }

    #[must_use]
    pub const fn secondary_plate(self) -> PlateId {
        self.secondary_plate
    }

    #[must_use]
    pub const fn kind(self) -> PlateBoundaryKind {
        self.kind
    }

    #[must_use]
    pub const fn ownership_margin_q60(self) -> i128 {
        self.ownership_margin_q60
    }

    #[must_use]
    pub const fn normal_motion_score(self) -> i128 {
        self.normal_motion_score
    }

    #[must_use]
    pub const fn shear_motion_score(self) -> i128 {
        self.shear_motion_score
    }
}

impl PlateField {
    /// Samples the two nearest spherical Voronoi owners and classifies their
    /// relative motion at the requested direction.
    ///
    /// # Panics
    ///
    /// Panics only if a `PlateField` is internally constructed with fewer than
    /// two plates. Public constructors always create at least six plates.
    #[must_use]
    pub fn boundary_at(&self, direction: UnitDirectionQ30) -> PlateBoundarySample {
        let (primary, primary_dot, secondary, secondary_dot) = self
            .plates()
            .iter()
            .copied()
            .fold(None, |state, plate| {
                let score = dot_q60(direction, plate.center());
                match state {
                    None => Some((plate, score, plate, i128::MIN)),
                    Some((best, best_score, second, second_score)) if score > best_score => {
                        Some((plate, score, best, best_score))
                    }
                    Some((best, best_score, _, second_score)) if score > second_score => {
                        Some((best, best_score, plate, score))
                    }
                    current => current,
                }
            })
            .expect("validated plate fields contain plates");

        let margin = primary_dot - secondary_dot;
        let (normal_motion, shear_motion) = relative_motion_scores(primary, secondary);
        let kind = if margin > BOUNDARY_MARGIN_Q60 {
            PlateBoundaryKind::Interior
        } else if normal_motion < -NORMAL_MOTION_THRESHOLD {
            PlateBoundaryKind::Convergent
        } else if normal_motion > NORMAL_MOTION_THRESHOLD {
            PlateBoundaryKind::Divergent
        } else {
            PlateBoundaryKind::Transform
        };

        PlateBoundarySample {
            primary_plate: primary.id(),
            secondary_plate: secondary.id(),
            kind,
            ownership_margin_q60: margin,
            normal_motion_score: normal_motion,
            shear_motion_score: shear_motion,
        }
    }
}

fn relative_motion_scores(primary: TectonicPlate, secondary: TectonicPlate) -> (i128, i128) {
    let normal_x = i128::from(secondary.center().x_q30() - primary.center().x_q30());
    let normal_y = i128::from(secondary.center().y_q30() - primary.center().y_q30());
    let normal_z = i128::from(secondary.center().z_q30() - primary.center().z_q30());

    let primary_motion = scaled_motion(primary);
    let secondary_motion = scaled_motion(secondary);
    let relative_x = secondary_motion.0 - primary_motion.0;
    let relative_y = secondary_motion.1 - primary_motion.1;
    let relative_z = secondary_motion.2 - primary_motion.2;

    let normal_motion = relative_x * normal_x + relative_y * normal_y + relative_z * normal_z;
    let relative_magnitude = relative_x.abs() + relative_y.abs() + relative_z.abs();
    let shear_motion = relative_magnitude
        .saturating_mul(i128::from(DIRECTION_Q30_SCALE))
        .saturating_sub(normal_motion.abs());
    (normal_motion, shear_motion)
}

fn scaled_motion(plate: TectonicPlate) -> (i128, i128, i128) {
    let motion = plate.motion();
    let speed = i128::from(motion.speed_micrometers_per_year());
    (
        i128::from(motion.x_q30()) * speed / i128::from(DIRECTION_Q30_SCALE),
        i128::from(motion.y_q30()) * speed / i128::from(DIRECTION_Q30_SCALE),
        i128::from(motion.z_q30()) * speed / i128::from(DIRECTION_Q30_SCALE),
    )
}

fn dot_q60(left: UnitDirectionQ30, right: UnitDirectionQ30) -> i128 {
    i128::from(left.x_q30()) * i128::from(right.x_q30())
        + i128::from(left.y_q30()) * i128::from(right.y_q30())
        + i128::from(left.z_q30()) * i128::from(right.z_q30())
}

#[cfg(test)]
mod tests {
    use super::PlateBoundaryKind;
    use crate::PlateField;

    #[test]
    fn plate_centers_are_classified_as_interior() {
        let field = PlateField::earth_like(42);
        for plate in field.plates() {
            assert_eq!(
                field.boundary_at(plate.center()).kind(),
                PlateBoundaryKind::Interior
            );
        }
    }

    #[test]
    fn boundary_sampling_is_deterministic() {
        let field = PlateField::earth_like(77);
        for plate in field.plates() {
            assert_eq!(
                field.boundary_at(plate.center()),
                field.boundary_at(plate.center())
            );
        }
    }

    #[test]
    fn every_sample_reports_distinct_plate_ids() {
        let field = PlateField::earth_like(9);
        for plate in field.plates() {
            let sample = field.boundary_at(plate.center());
            assert_ne!(sample.primary_plate(), sample.secondary_plate());
            assert!(sample.ownership_margin_q60() >= 0);
        }
    }
}
