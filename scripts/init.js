import { SimpleActorSheet } from "../../../systems/worldbuilding/module/actor-sheet.js";

class ICONSheet extends SimpleActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ICONSheet", "worldbuilding", "sheet", "actor"],
      template: "modules/icon-145-sheet/templates/icon-actor-sheet.html",
      width: 600,
      height: 600,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
      scrollY: [".biography", ".items", ".attributes"],
      dragDrop: [{dragSelector: ".item-list .item", dropSelector: null}]
    });
  }
  
  async _onItemSummary(event) {
    event.preventDefault();
    const li = $(event.currentTarget).parents(".item");
    const item = this.actor.items.get(li.data("item-id"));
    const chatData = await item.system;

    // Toggle summary
    if ( li.hasClass("expanded") ) {
      let summary = li.children(".item-summary");
      summary.slideUp(200, () => summary.remove());
    } else {
	  const enriched = await TextEditor.enrichHTML(chatData.description, {async: true});
      let div = $(`<div class="item-summary">${enriched}</div>`);
      let props = $('<div class="item-properties"></div>');
	  const attrs = Object.values(chatData.attributes.Tags);
	  for (let index = 0; index < attrs.length; ++index) {
		  console.log(attrs.length)
		  const here = attrs[index];
		  if (index == attrs.length-1){
			  props.append(`<span class="tag">${here.label}</span>`);
			  }
			else {
				props.append(`<span class="tag">${here.label}, </span>`);
				}
	}
      //attrs.forEach(p => props.append(`<span class="tag">${p.label}</span>`));
	  div.append(`<hr>`);
      div.append(props);
      li.append(div.hide());
      div.slideDown(200);
    }
    li.toggleClass("expanded");
  }
  
  async _onItemUse(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.items.get(itemId);
    const token = this.actor.token;
    const templateData = {
      tokenId: token?.uuid || null,
      title: item.name,
      description: item.system.description,
      //labels: item.system,
	  //img: item.img
    };
    const html = await renderTemplate("modules/icon-145-sheet/templates/chatcard.hbs", templateData);
    // Create the ChatMessage data object
    const chatData = {
      user: game.user.id,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      content: html,
      speaker: ChatMessage.getSpeaker({actor: this.actor, token})
    };

    // Create the Chat Message or return its data
    const card = await ChatMessage.create(chatData)
	
	return card
  }
  
  activateListeners(html) {
    super.activateListeners(html);
	html.find(".item-name").click(event => this._onItemSummary(event));
	html.find("[data-item-id] img").click(event => this._onItemUse(event));
}
}
Actors.registerSheet("icon-145-sheet", ICONSheet, { makeDefault: true });