/**
 * A port of the spell template feature from DnD5e
 * https://gitlab.com/foundrynet/dnd5e/-/blob/master/module/pixi/ability-template.js
 */

const RangeType = {
  Range: "Range",
  Threat: "Threat",
  Thrown: "Thrown",
  Line: "Line",
  Cone: "Cone",
  Blast: "Blast",
  Burst: "Burst",
}

/**
 * MeasuredTemplate sublcass to create a placeable template on weapon attacks
 * @example
 * ```javascript
 * const template = WeaponRangeTemplate.fromRange({
 *   type: "Cone",
 *   val: "5",
 * });
 * template?.placeTemplate()
 *   .catch(() => {}) // Handle canceled
 *   .then(t => {
 *     if (t) {
 *       // t is a MeasuredTemplate with flag data
 *     }
 * });
 * ```
 */
export class WeaponRangeTemplate extends MeasuredTemplate {
  get range() {
    return this.document.getFlag(game.system.id, "range");
  }

  get isBurst() {
    return this.range.type === RangeType.Burst;
  }

  actorSheet;

  /**
   * Creates a new WeaponRangeTemplate from a provided range object
   * @param type - Type of template. A RangeType in typescript, or a string in js.
   * @param val  - Size of template. A numeric string
   * @param creator - A token that is designated as the owner of the template.
   *                  Used to deterimine the character sheet to close as well
   *                  as a default ignore target for Cones and Lines.
   */
  static fromRange({ type, val }, creator = undefined) {
    if (!canvas.ready) return null;
    const dist = val;
    if (isNaN(dist)) return null;
    const hex = (canvas.grid?.type ?? 0) >= 2;
    const grid_distance = canvas.scene?.dimensions?.distance ?? 1;

    let shape;
    switch (type) {
      case RangeType.Cone:
        shape = "cone";
        break;
      case RangeType.Line:
        shape = "ray";
        break;
      case RangeType.Burst:
	    shape = "rect";
		break
      case RangeType.Blast:
        shape = "circle";
        break;
      default:
        return null;
    }

    const scale = 1; // hex ? Math.sqrt(3) / 2 : 1;
	if(shape == "rect"){
		var shape_dir = 45
	} else {
		var shape_dir = 0
	}
    const templateData = {
      t: shape,
      user: game.user.id,
      distance: (dist + 0.1) * scale * grid_distance,
      width: scale * grid_distance,
      direction: shape_dir,
      x: 0,
      y: 0,
      angle: 58,
      fillColor: game.user.color,
      flags: {
        [game.system.id]: {
          range: { type, val },
          creator: creator?.id,
          ignore: {
            tokens: [RangeType.Blast, RangeType.Burst].includes(type) || !creator ? [] : [creator.id],
            dispositions: [],
          },
        },
      },
    };

    const cls = CONFIG.MeasuredTemplate.documentClass;
    const template = new cls(templateData, { parent: canvas.scene ?? undefined });
    const object = new this(template);
    object.actorSheet = creator?.actor?.sheet ?? undefined;
    return object;
  }

  /**
   * Start placement of the template. Returns immediately, so cannot be used to
   * block until a template is placed.
   * @deprecated Since 1.0
   */
  drawPreview() {
    console.warn("WeaponRangeTemplate.drawPreview() is deprecated and has been replaced by placeTemplate()");
    this.placeTemplate().catch(() => {});
  }

  /**
   * Start placement of the template.
   * @returns A Promise that resolves to the final MeasuredTemplateDocument or
   * rejects when creation is canceled or fails.
   */
  placeTemplate() {
    if (!canvas.ready) {
      ui.notifications?.error("Cannot create WeaponRangeTemplate. Canvas is not ready");
      throw new Error("Cannot create WeaponRangeTemplate. Canvas is not ready");
    }
    this.actorSheet?.minimize();
    const initialLayer = canvas.activeLayer;
    this.draw();
    this.layer.activate();
    this.layer.preview?.addChild(this);
    return this.activatePreviewListeners(initialLayer);
  }

  activatePreviewListeners(initialLayer) {
    return new Promise((resolve, reject) => {
      const handlers = {};
      let moveTime = 0;

      // Update placement (mouse-move)
      handlers.mm = (event) => {
        event.stopPropagation();
        let now = Date.now(); // Apply a 20ms throttle
        if (now - moveTime <= 20) return;
        const center = event.data.getLocalPosition(this.layer);
        let snapped = this.snapToCenter(center);

        if (this.isBurst) snapped = this.snapToToken(center);

        // @ts-expect-error
        this.document.updateSource({ x: snapped.x, y: snapped.y });
        this.refresh();
        moveTime = now;
      };

      // Cancel the workflow (right-click)
      handlers.rc = (_e, do_reject = true) => {
        this.actorSheet?.maximize();
        // Remove the preview
        this.layer.preview?.removeChildren().forEach(c => c.destroy());
        canvas.stage?.off("mousemove", handlers.mm);
        canvas.stage?.off("mousedown", handlers.lc);
        canvas.app.view.oncontextmenu = null;
        canvas.app.view.onwheel = null;
        initialLayer?.activate();
        if (do_reject) reject(new Error("Template creation cancelled"));
      };

      // Confirm the workflow (left-click)
      handlers.lc = async (event) => {
        handlers.rc(event, false);
        let destination = this.snapToCenter(event.data.getLocalPosition(this.layer));
        if (this.isBurst) {
          destination = this.snapToToken(event.data.getLocalPosition(this.layer));
          //@ts-expect-error v10
          const token = this.document.flags[game.system.id].burstToken;
          if (token) {
            //@ts-expect-error v10
            const ignore = this.document.flags[game.system.id].ignore.tokens;
            ignore.push(token);
            //@ts-expect-error
            this.document.updateSource({
              [`flags.${game.system.id}.ignore.tokens`]: ignore,
            });
          }
        }
        //@ts-expect-error
        this.document.updateSource(destination);
        const template = MeasuredTemplateDocument(
          await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [this.document.toObject()])
        ).shift();
        if (template === undefined) {
          reject(new Error("Template creation failed"));
          return;
        }
        resolve(template);
      };

      // Rotate the template by 3 degree increments (mouse-wheel)
      handlers.mw = (event) => {
        if (event.ctrlKey) event.preventDefault(); // Avoid zooming the browser window
        event.stopPropagation();
        let delta = canvas.grid.type > CONST.GRID_TYPES.SQUARE ? 30 : 15;
        let snap = event.shiftKey ? delta : 5;
        //@ts-expect-error
        this.document.updateSource({ direction: this.data.direction + snap * Math.sign(event.deltaY) });
        this.refresh();
      };

      // Activate listeners
      canvas.stage.on("mousemove", handlers.mm);
      canvas.stage.on("mousedown", handlers.lc);
      canvas.app.view.oncontextmenu = handlers.rc;
      canvas.app.view.onwheel = handlers.mw;
    });
  }

  /**
   * Snapping function to only snap to the center of spaces rather than corners.
   */
  snapToCenter({ x, y }) {
    const snapped = canvas.grid.getCenter(x, y);
    return { x: snapped[0], y: snapped[1] };
  }

  /**
   * Snapping function to snap to the center of a hovered token. Also resizes
   * the template for bursts.
   */
  snapToToken({ x, y }) {
    const token = canvas
      .tokens.placeables.filter(t => {
        // test if cursor is inside token
        return t.x < x && t.x + t.w > x && t.y < y && t.y + t.h > y;
      })
      .reduce((r, t) => {
        // skip hidden tokens
        if (!t.visible) return r;
        // use the token that is closest.
        if (
          r === null ||
          r === undefined ||
          canvas.grid.measureDistance({ x, y }, t.center) < canvas.grid.measureDistance({ x, y }, r.center)
        )
          return t;
        else return r;
      }, null);
    if (token) {
      //@ts-expect-error
      this.document.updateSource({
        // @ts-expect-error v10
        distance: this.getBurstDistance(token.document.width),
        [`flags.${game.system.id}.burstToken`]: token.id,
      });
      return token.center;
    } else {
      //@ts-expect-error
      this.document.updateSource({ distance: this.getBurstDistance(1) });
      return this.snapToCenter({ x, y });
    }
  }

  /**
   * Get fine-tuned sizing data for Burst templates
   */
  getBurstDistance(size) {
    const hex = canvas.grid.type > 1;
    let val = this.range.val;
    if (hex) {
      if (size === 2) val += 0.7 - (val > 2 ? 0.1 : 0);
      if (size === 3) val += 1.2;
      if (size === 4) val += 1.5;
    } else {
      if (size === 2) val += 0.9;
      if (size === 3) val += 1.4;
      if (size === 4) val += 1.9;
    }
    return val + 0.1;
  }
}
