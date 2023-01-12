
import { BladesSheet } from "./blades-sheet.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {BladesSheet}
 */
export class BladesClockSheet extends BladesSheet {

  /** @override */
	static get defaultOptions() {
	  return foundry.utils.mergeObject(super.defaultOptions, {
  	  classes: ["blades-in-the-dark", "sheet", "actor", "clock"],
  	  template: "modules/icon_data/templates/clock-sheet.html",
      width: 420,
      height: 400,
    });
  }

  /* -------------------------------------------- */

  /** @override */
  getData(options) {
    const superData = super.getData( options );
    const sheetData = superData.data;
    sheetData.owner = superData.owner;
    sheetData.editable = superData.editable;
    sheetData.isGM = game.user.isGM;

    return sheetData;
  }

    /* -------------------------------------------- */

  /** @override */
  async _updateObject(event, formData) {
    let image_path = `modules/icon-145-data-wip/themes/gms-red/${formData['system.type']}clock_${formData['system.value']}.png`;
    formData['img'] = image_path;
    formData['prototypeToken.texture.src'] = image_path;
    let data = [];
    let update = {
      img: image_path,
      width: 1,
      height: 1,
      scale: 1,
      mirrorX: false,
      mirrorY: false,
      tint: "",
      displayName: 50
    };

    let tokens = this.actor.getActiveTokens();
    tokens.forEach( function( token ) {
      data.push(
        foundry.utils.mergeObject(
          { _id: token.id },
          update
        )
      );
    });
    await TokenDocument.updateDocuments( data, { parent: game.scenes.current } )

    // Update the Actor
    return this.object.update(formData);
  }

  /* -------------------------------------------- */

}
