import { SimpleActorSheet } from "../../../systems/worldbuilding/module/actor-sheet.js";
import { SimpleItemSheet } from "../../../systems/worldbuilding/module/item-sheet.js";
import { bladesRoll } from "./blades-roll.js";
import { BladesHelpers } from "./blades-helpers.js";
import { BladesActor } from "./blades-actor.js";
import { BladesClockSheet } from "./blades-clock-sheet.js";

function getValue(name) {
  var value = document.querySelector('input[name="${name}"]:checked').value;
}

Hooks.once("init", async function() {
  console.log(`Initializing ICON System`);

  game.system.bladesClocks = {
    sizes: [ 4, 6, 8, 10, 12 ]
  };
  
  await loadTemplates([
    // Attribute list partial.
    "modules/icon_data/templates/parts/icon-sheet-attributes.html",
    "modules/icon_data/templates/parts/icon-sheet-groups.html",
  ]);
})

Handlebars.registerHelper('blades-clock', function(parameter_name, type, current_value, uniq_id, theme) {
    let html = '';

    if (current_value === null || current_value === 'null') {
      current_value = 0;
    }

    if (parseInt(current_value) > parseInt(type)) {
      current_value = type;
    }

    // Label for 0
    html += `<label class="clock-zero-label" for="clock-${type}-0-${theme}"><i class="fab fa-creative-commons-zero nullifier"></i></label>`;
    html += `<div id="blades-clock-${uniq_id}" class="blades-clock clock-${type} clock-${type}-${current_value}" style="background-image:url('modules/icon_data/themes/${theme}/${type}clock_${current_value}.png');">`;

    let zero_checked = (parseInt(current_value) === 0) ? 'checked' : '';
    html += `<input type="radio" value="0" id="clock-${type}-0-${theme}" data-dType="String" name="${parameter_name}" ${zero_checked}>`;

    for (let i = 1; i <= parseInt(type); i++) {
      let checked = (parseInt(current_value) === i) ? 'checked' : '';
      html += `
        <input type="radio" value="${i}" id="clock-${type}-${i}-${theme}" data-dType="String" name="${parameter_name}" ${checked}>
        <label for="clock-${i}-${uniq_id}-${theme}"></label>
      `;
    }

    html += `</div>`;
    return html;
  });
  


  
Handlebars.registerHelper('times_from_0', function(n, block) {

    var accum = '';
    for (var i = 0; i <= n; ++i) {
      accum += block.fn(i);
    }
    return accum;
  });


class ICONSheet extends SimpleActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ICONSheet", "worldbuilding", "sheet", "actor"],
      template: "modules/icon_data/templates/icon-actor-sheet.html",
      width: 600,
      height: 600,
      tabs: [{navSelector: ".bond-tabs", contentSelector: ".bond-body", initial: "bond-info"},
	  {navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
      scrollY: [".narrative",".traits", ".items", ".attributes"],
      dragDrop: [{dragSelector: ".trait-list .item-list .item", dropSelector: null}]
    });
  }
 
  async getData(options) {
    const context = await super.getData(options);
    for (const item of context.data.items) {
		item.isTrait = item.flags?.['icon_data']?.isTrait || false
		item.isBondPower = item.flags?.['icon_data']?.isBondPower || false
		item.isCampFixture = item.flags?.['icon_data']?.isCampFixture || false
		try {
		item.Talents = Object.entries(item.flags?.['icon_data']).filter(t => t[0].includes('Talent')).map((t,i) => ({name:t[0],value:t[1]}))
		}
		catch (e) {
			//pass
		}
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
	  let enriched = chatData.description
	  for (let i=1; i<8; i++) {
		  let Talent = "Talent" + i
		  if (!!chatData.attributes.Talents?.[Talent]?.value && item.flags?.['icon_data']?.[Talent]) {
			  enriched = enriched + chatData.attributes.Talents[Talent].value
		  }
	  }
	  enriched = await TextEditor.enrichHTML(enriched, {async: true});
      let div = $(`<div class="item-summary">${enriched}</div>`);
      let props = $('<div class="item-properties"></div>');
	  const attrs = Object.values(chatData.attributes.Tags);
	  for (let index = 0; index < attrs.length; ++index) {
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
	let description = item.system.description;
	for (let i=1; i<8; i++) {
		  let Talent = "Talent" + i
		  if (!!item.system.attributes.Talents?.[Talent]?.value && item.flags?.['icon_data']?.[Talent]) {
			  description = description + item.system.attributes.Talents[Talent].value
		  }
	  }
    const token = this.actor.token;
    const templateData = {
      tokenId: token?.uuid || null,
      title: item.name,
      description: description,
      labels: item.system,
	  img: item.img
    };
    const html = await renderTemplate("modules/icon_data/templates/chatcard.hbs", templateData);
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
			flags: { ['icon_data'] : { isTrait: true }} }, 
			{parent: this.actor});
      case "edit":
        return item.sheet.render(true);
      case "delete":
        return item.delete();
    }
  }
  
  _onBondControl(event) {
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
			flags: { ['icon_data'] : { isBondPower: true }} }, 
			{parent: this.actor});
      case "edit":
        return item.sheet.render(true);
      case "delete":
        return item.delete();
    }
  }
  
  _onCampControl(event) {
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
			flags: { ['icon_data'] : { isCampFixture: true }} }, 
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
	html.find(".bond-power-control").click(this._onBondControl.bind(this));
	html.find(".camp-fixture-control").click(this._onCampControl.bind(this));
	html.find("[data-item-id] img").click(event => this._onItemUse(event));
	html.find('.click-to-set').click(ev => {
		let stat = ev.currentTarget.dataset.stat
		let value = ev.currentTarget.dataset.value
		let object = {[stat]: value}
		this.actor.update(object)
		})
	html[0].querySelectorAll(".talent-checkbox").forEach(b => {b.addEventListener("change", async (event) => {
    const checked = b.checked;
    const {type, id} = b.dataset;
    const item = this.object.items.get(id);
    await item.setFlag("icon_data", type, checked);
  });
});
}

_updateObject(event, formData) {
  super._updateObject(event, formData);
}




}

class OldIconSheet extends ICONSheet {
	static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["OldIconSheet", "ICONSheet", "worldbuilding", "sheet", "actor"],
      template: "modules/icon_data/templates/icon-sheet-old.html",
      width: 600,
      height: 600,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
      scrollY: [".biography", ".items", ".attributes"],
      dragDrop: [{dragSelector: ".trait-list .item-list .item", dropSelector: null}]
    });
  }
}


class IconPlayerSheet extends ICONSheet {
static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["IconPlayerSheet", "ICONSheet", "worldbuilding", "sheet", "actor"],
      template: "modules/icon_data/templates/icon-player-sheet.html",
      width: 700,
      height: 700,
      tabs: [{navSelector: ".bond-tabs", contentSelector: ".bond-body", initial: "bond-info"},
	  {navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
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
  
  
  BladesGetRollData(skill_name) {
    const rollData = this.actor.getRollData();
    rollData.dice_amount = parseInt(this.object.system.attributes.skills[skill_name].value)

    return rollData;
  }

  rollAttributePopup(attribute_name) {

    // const roll = new Roll("1d20 + @abilities.wis.mod", actor.getRollData());
    let attribute_label = attribute_name;

    let content = `
        <h2>${game.i18n.localize('BITD.Roll')} ${game.i18n.localize(attribute_label)}</h2>
        <form>
          <div class="form-group">
            <label>${game.i18n.localize('BITD.Modifier')}:</label>
            <select id="mod" name="mod">
              ${this.createListOfDiceMods(-3,+3,0)}
            </select>
          </div>`;
      content += `
            <div class="form-group">
              <label>${game.i18n.localize('BITD.Position')}:</label>
              <select id="pos" name="pos">
                <option value="controlled">${game.i18n.localize('BITD.PositionControlled')}</option>
                <option value="risky" selected>${game.i18n.localize('BITD.PositionRisky')}</option>
                <option value="desperate">${game.i18n.localize('BITD.PositionDesperate')}</option>
              </select>
            </div>
            <div class="form-group">
              <label>${game.i18n.localize('BITD.Effect')}:</label>
              <select id="fx" name="fx">
                <option value="limited">${game.i18n.localize('BITD.EffectLimited')}</option>
                <option value="standard" selected>${game.i18n.localize('BITD.EffectStandard')}</option>
                <option value="great">${game.i18n.localize('BITD.EffectGreat')}</option>
              </select>
            </div>`;
    content += `
        <div className="form-group">
          <label>${game.i18n.localize('BITD.Notes')}:</label>
          <input id="note" name="note" type="text" value="">
        </div><br/>
        </form>
      `;

    new Dialog({
      title: `${game.i18n.localize('BITD.Roll')} ${game.i18n.localize(attribute_label)}`,
      content: content,
      buttons: {
        yes: {
          icon: "<i class='fas fa-check'></i>",
          label: game.i18n.localize('BITD.Roll'),
          callback: async (html) => {
            let modifier = parseInt(html.find('[name="mod"]')[0].value);
            let position = html.find('[name="pos"]')[0].value;
            let effect = html.find('[name="fx"]')[0].value;
            let note = html.find('[name="note"]')[0].value;
            await this.rollAttribute(attribute_name, modifier, position, effect, note);
          }
        },
        no: {
          icon: "<i class='fas fa-times'></i>",
          label: game.i18n.localize('Close'),
        },
      },
      default: "yes",
    }).render(true);

  }

  /* -------------------------------------------- */

  async rollAttribute(attribute_name = "", additional_dice_amount = 0, position, effect, note) {

    let dice_amount = 0;
    if (attribute_name !== "") {
      let roll_data = this.BladesGetRollData(attribute_name);
      dice_amount += roll_data.dice_amount;
    }
    else {
      dice_amount = 1;
    }
    dice_amount += additional_dice_amount;
    await bladesRoll(dice_amount, attribute_name, position, effect, note);
  }

  /* -------------------------------------------- */

  /**
   * Create <options> for available actions
   *  which can be performed.
   */
  createListOfActions() {

    let text, attribute, skill;
    let attributes = this.system.attributes;

    for ( attribute in attributes ) {

      const skills = attributes[attribute].skills;

      text += `<optgroup label="${attribute} Actions">`;
      text += `<option value="${attribute}">${attribute} (Resist)</option>`;

      for ( skill in skills ) {
        text += `<option value="${skill}">${skill}</option>`;
      }

      text += `</optgroup>`;

    }

    return text;

  }

  /* -------------------------------------------- */

  /**
   * Creates <options> modifiers for dice roll.
   *
   * @param {int} rs
   *  Min die modifier
   * @param {int} re
   *  Max die modifier
   * @param {int} s
   *  Selected die
   */
  createListOfDiceMods(rs, re, s) {

    var text = ``;
    var i = 0;

    if ( s == "" ) {
      s = 0;
    }

    for ( i  = rs; i <= re; i++ ) {
      var plus = "";
      if ( i >= 0 ) { plus = "+" };
      text += `<option value="${i}"`;
      if ( i == s ) {
        text += ` selected`;
      }

      text += `>${plus}${i}d</option>`;
    }

    return text;

  }
  
  async _onRollAttributeDieClick(event) {

    const attribute_name = $(event.currentTarget).data("rollAttribute");
    this.rollAttributePopup(attribute_name);

  }
  
  activate(tabName="bond-info", {triggerCallback=false}={}) {

    // Validate the requested tab name
    const group = this._nav.dataset.group;
    const items = this._nav.querySelectorAll("[data-tab]");
	
  }
  
  activateListeners(html) {
    super.activateListeners(html);
	html.find(".roll-die-attribute").click(this._onRollAttributeDieClick.bind(this));
	if ( this.options.submitOnChange ) {
      html.on("change", "textarea", this._onChangeInput.bind(this));  // Use delegated listener on the form
    }
  }
  
}

class IconCampSheet extends IconPlayerSheet {
	static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["IconCampSheet", "ICONSheet", "worldbuilding", "sheet", "actor"],
      template: "modules/icon_data/templates/icon-camp-sheet.html",
      width: 700,
      height: 700,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
      scrollY: [".biography", ".items", ".attributes"],
      dragDrop: [{dragSelector: ".trait-list .item-list .item", dropSelector: null}]
    });
  }
}

class IconItemSheet extends SimpleItemSheet {
	static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["IconItemSheet", "worldbuilding", "sheet", "item"],
      template: "modules/icon_data/templates/icon-item-sheet.html",
      width: 520,
      height: 480,
      tabs: [{navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description"}],
      scrollY: [".attributes"],
    });
  }
  
  async getData(options){
	  const context = await super.getData(options);
	  try {
		context.data.Talents = Object.entries(context.item.flags?.['icon_data']).filter(t => t[0].includes('Talent')).map((t,i) => ({name:t[0],value:t[1],datapath:"system.attributes.Talents."+t[0]+".value",rootpath:"@root."+t[0]+"HTML"}))
		}
		catch (e) {
			console.log("error")
			//pass
		}
	try {
	  context.Talent1HTML = await TextEditor.enrichHTML(context.systemData.attributes.Talents.Talent1.value, {
	  secrets: this.document.isOwner,
      async: true
    }) || "";
	context.Talent2HTML = await TextEditor.enrichHTML(context.systemData.attributes.Talents.Talent2.value, {
	  secrets: this.document.isOwner,
      async: true
    }) || "";
	context.Talent3HTML = await TextEditor.enrichHTML(context.systemData.attributes.Talents.Talent3.value, {
	  secrets: this.document.isOwner,
      async: true
    }) || "";
	context.Talent4HTML = await TextEditor.enrichHTML(context.systemData.attributes.Talents.Talent4.value, {
	  secrets: this.document.isOwner,
      async: true
    }) || "";
	context.Talent5HTML = await TextEditor.enrichHTML(context.systemData.attributes.Talents.Talent5.value, {
	  secrets: this.document.isOwner,
      async: true
    }) || "";
	context.Talent6HTML = await TextEditor.enrichHTML(context.systemData.attributes.Talents.Talent6.value, {
	  secrets: this.document.isOwner,
      async: true
    }) || "";
	context.Talent7HTML = await TextEditor.enrichHTML(context.systemData.attributes.Talents.Talent7.value, {
	  secrets: this.document.isOwner,
      async: true
    }) || "";
	}
	catch (e) {
		//pass
	}
    return context;
  }
  }

Actors.registerSheet("icon-player-sheet", IconPlayerSheet, { makeDefault: false });
Actors.registerSheet("icon-sheet-old", OldIconSheet, { makeDefault: false });
Actors.registerSheet("icon_data", ICONSheet, { makeDefault: true });
Actors.registerSheet("icon-camp-sheet", IconCampSheet, { makeDefault: false});
Items.registerSheet("icon-item-sheet", IconItemSheet, { makeDefault: true });