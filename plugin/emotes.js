// emotes.js | getting emotes from twitch/bttv

module.exports = App => {

	App.checkEmotes = function (event) {
		if (!this.config.emojis) return
		let words = event.text.split(" ")
		let found = {}
		// check every word for an emote
		for (let i = 0; i < words.length; i++) {
			let icon = this.parseEmote(words[i])
			if (icon) found[words[i]] = icon
		}
		// replace any found emotes
		let list = Object.keys(found)
		if (list.length) {
			let first = list[0].split(":p").join("")
			let $text = $(`.chat .text:contains("${ first }")`)
			if (!$text.length) return

			let html = $text[0].innerHTML
			for (let icon in found) {
				let name = icon.split(":p").join("")
				html = html.split(name).join(found[icon])
			}
			// remove the tongue emoji :c 
			let tongue = `<span title="stuck_out_tongue" class="emoji emoji-stuck_out_tongue emoji-small"></span>`
			$text[0].innerHTML = html.split(tongue).join("")
		}
	}

	App.parseEmote = function (str) {
		if (str[0] != ":" || str[str.length - 1] != ":") return
		let name = str.split(":").join("").toLowerCase()

		if (this.twitchIcons[name]) {
			let icon = this.twitchIcons[name]
			let base = "https://static-cdn.jtvnw.net/emoticons/v2"
			return `<img src="${ base }/${ icon }/static/light/1.0">`
		}
		if (this.bttvIcons[name]) {
			let icon = this.bttvIcons[name]
			let base = "https://cdn.betterttv.net/emote"
			return `<img src="${ base }/${ icon }/1x">`
		}
	}

	App.runEmote = function (event) {
		if (!this.config.emojis) return
		let text = event.text.split(" ")
		for (var i = 0; i < text.length; i++) {
			let icon = this.getEmote(text[i])
			if (icon) text[i] = icon
		}
		if (event.text !== text.join(" ")) {
			this.addEmote(event.text, text.join(" "))
		}
	}

	App.addEmote = async function (find, replace) {
		// check for replaced :P smileys
		if (find.indexOf(":p") > -1) find = find.split(":p")[0]
		let $el = $(".chat .message:last-of-type .text:last-of-type")[0]
		if (!$el.innerHTML.indexOf(find) < 0) return
		$el.innerHTML = replace
	}

	App.on("speak", App.checkEmotes)

}