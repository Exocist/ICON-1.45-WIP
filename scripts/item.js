import { SimpleItemSheet } from "../../../systems/worldbuilding/module/item-sheet.js";

export class ICONItem extends SimpleItem {

async getChatData(htmlOptions={}) {
    const data = this.toObject().system;
    const labels = this.labels;

    // Rich text description
    data.description.value = await TextEditor.enrichHTML(data.description.value, {
      async: true,
      relativeTo: this,
      ...htmlOptions
    });
    return data;
  }
 
}