import { EconomicObserverScene as BaseScene } from './economic-scene.js';

export class EconomicObserverScene extends BaseScene {
  constructor(container, options = {}) {
    super(container, options);
    this.coarseMode = globalThis.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    this.rebuildInterval = this.coarseMode ? 4 : 2;
    this.lastSceneMonth = null;
    this.lastFrameAt = 0;
    this.frameIntervalMs = 1000 / (this.coarseMode ? 24 : 40);

    this.renderer.setPixelRatio(Math.min(this.coarseMode ? 1.2 : 1.5, globalThis.devicePixelRatio || 1));
    if (this.coarseMode) {
      this.renderer.shadowMap.enabled = false;
      this.scene.traverse(object => {
        if ('castShadow' in object) object.castShadow = false;
        if ('receiveShadow' in object) object.receiveShadow = false;
      });
    }
    this.resize();
  }

  update(observerData) {
    const month = Number(observerData?.month || 0);
    const first = this.lastSceneMonth === null || this.countryGroups.size === 0;
    const due = first || month < this.lastSceneMonth || month - this.lastSceneMonth >= this.rebuildInterval;
    this.currentData = observerData;

    if (due) {
      super.update(observerData);
      this.lastSceneMonth = month;
      return;
    }

    if (!this.selectedCountryId && observerData.countries?.length) {
      this.selectedCountryId = observerData.countries[0].id;
    }
    this.setSelectedCountry(this.selectedCountryId);
  }

  animate(now = 0) {
    this.animationFrame = requestAnimationFrame(this.animate);
    if (document.hidden) return;
    const interval = this.frameIntervalMs || 1000 / 30;
    if (now - (this.lastFrameAt || 0) < interval) return;
    this.lastFrameAt = now;

    const elapsed = this.clock?.getElapsedTime?.() || 0;
    this.controls?.update?.();
    for (const animation of this.flowAnimations || []) {
      const t = (animation.phase + elapsed * animation.speed) % 1;
      animation.mesh.position.copy(animation.curve.getPointAt(t));
    }
    this.updateLabels?.();
    this.renderer?.render?.(this.scene, this.camera);
  }
}
