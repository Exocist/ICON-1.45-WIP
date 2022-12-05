import { SimpleActorSheet } from "../../../systems/worldbuilding/module/actor-sheet.js";

Handlebars.registerHelper('multiboxes', function(selected, options) {

    let html = options.fn(this);

    // Fix for single non-array values.
    if ( !Array.isArray(selected) ) {
      selected = [selected];
    }

    if (typeof selected !== 'undefined') {
      selected.forEach(selected_value => {
        if (selected_value !== false) {
          let escapedValue = RegExp.escape(Handlebars.escapeExpression(selected_value));
          let rgx = new RegExp(' value=\"' + escapedValue + '\"');
          let oldHtml = html;
          html = html.replace(rgx, "$& checked");
          while( ( oldHtml === html ) && ( escapedValue >= 0 ) ){
            escapedValue--;
            rgx = new RegExp(' value=\"' + escapedValue + '\"');
            html = html.replace(rgx, "$& checked");
          }
        }
      });
    }
	if (html !== null) {
    return html;
	}
  });

class ICONSheet extends SimpleActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ICONSheet", "worldbuilding", "sheet", "actor"],
      template: "modules/icon-145-data-wip/templates/icon-actor-sheet.html",
      width: 600,
      height: 600,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
      scrollY: [".traits", ".items", ".attributes"],
      dragDrop: [{dragSelector: ".trait-list .item-list .item", dropSelector: null}]
    });
  }
  
  async getData(options) {
    const context = await super.getData(options);
    for (const item of context.data.items) {
		item.isTrait = item.flags?.['icon-145-data-wip']?.isTrait || false
	}
    return context;
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
      labels: item.system,
	  //img: item.img
    };
    const html = await renderTemplate("modules/icon-145-data-wip/templates/chatcard.hbs", templateData);
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
  
  _onTraitControl(event) {
	console.log("here")
    event.preventDefault();
	
    // Obtain event data
    const button = event.currentTarget;
    const li = button.closest(".item");
    const item = this.actor.items.get(li?.dataset.itemId);

    // Handle different actions
    switch ( button.dataset.action ) {
      case "create":
        const cls = getDocumentClass("Item");
        return cls.create({
			name: game.i18n.localize("SIMPLE.ItemNew"), 
			type: "item", 
			flags: { ['icon-145-data-wip'] : { isTrait: true }} }, 
			{parent: this.actor});
      case "edit":
        return item.sheet.render(true);
      case "delete":
        return item.delete();
    }
  }

  
  activateListeners(html) {
    super.activateListeners(html);
	html.find(".item-name").click(event => this._onItemSummary(event));
	html.find(".trait-control").click(this._onTraitControl.bind(this));
	html.find("[data-item-id] img").click(event => this._onItemUse(event));
}

_updateObject(event, formData) {
  console.log("FormData:", duplicate(formData));
  super._updateObject(event, formData);
}


}

class IconPlayerSheet extends ICONSheet {
static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["IconPlayerSheet", "ICONSheet", "worldbuilding", "sheet", "actor"],
      template: "modules/icon-145-data-wip/templates/icon-player-sheet.html",
      width: 700,
      height: 700,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
      scrollY: [".narrative", ".biography", ".items", ".attributes"],
      dragDrop: [{dragSelector: ".item-list .item", dropSelector: null}]
    });
  }
  
  async getData(options) {
    const context = await super.getData(options);
    context.narrativeHTML = await TextEditor.enrichHTML(context.systemData.narrative, {
      secrets: this.document.isOwner,
      async: true
    });
    return context;
  }
  
  activateListeners(html) {
    super.activateListeners(html);
  }
  
}
Actors.registerSheet("icon-player-sheet", IconPlayerSheet, { makeDefault: false });
Actors.registerSheet("icon-145-data-wip", ICONSheet, { makeDefault: true });