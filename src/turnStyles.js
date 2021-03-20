// turnStyles.js

// the main initiation
const tS = function() {
	this.loadConfig()
	this.loadThemes()
	this.attachRoom()
}

// defaults & utilities
tS.prototype.__ = {
	config: {
		autobop: true,

		theme: "dark",
		style: "",

		ping_pm: false,
		ping_song: false,
		ping_chat: false,

		chat_stat: false,
		chat_snag: false,
		chat_join: false,
		chat_gone: false
	},
	options: {
		theme: {
			dark: "Dark Mode",
			night: "Night Mode",
		},
		style: {
			pink: "Pink",
			blue: "Blue",
			teal: "Teal",
			green: "Green",
		},
	},

	log: (str, obj) => {
		obj = obj ? JSON.stringify(obj, 0, 2) : ''
		console.info(`turnStyles :: ${str}`, obj)
	},
	// check if obj exists and has a key
	has: (obj, key) => obj !== null && typeof obj != "undefined" && obj[key]
}
// attach to the turntable room
tS.prototype.attachRoom = function() {
	this.core = window.turntable
	if (!this.core) return this.__.log("where are we?")
	this.user = this.core.user.id
	let again = () => setTimeout(tS.prototype.attachRoom.bind(this), 250)

	// let's find the room
	for (let x in this.core) {
		if (this.__.has(this.core[x], "roomId")) {
			this.room = this.core[x]
			break
		}
	}

	if (!this.room) return again()

	// find the room manager
	for (let x in this.room) {
		if (this.__.has(this.room[x], "roomData")) {
			this.ttbl = this.room[x]
			break
		}
	}
	// try again if we can't find it
	if (!this.ttbl) return again()

	// record any currently playing song
	if (this.room.currentSong) {
		this.now_playing = {
			snag: 0, hate: 0,
			love: this.room.upvoters.length,
			...this.room.currentSong.metadata
		}
	}

	this.core.addEventListener('message', this.runEvents.bind(this))

	this.__.log(`loaded room: ${this.room.roomId}`)

	this.runAutobop()
	this.buildPanel()
}

// define our "database"
tS.prototype.loadConfig = function() {
	const store = window.localStorage.getItem("tsdb")
	this.config = store ? JSON.parse(store) : {}

	// apply our defaults for any config upgrades
	this.config = { ...this.__.config, ...this.config }

	this.base = window.tsBase || 'https://ts.pixelcrisis.co/src/'
	this.__.log("loaded config")
}
tS.prototype.saveConfig = function() {
	this.config.theme     = $("#ts_theme").val()
	this.config.style     = $("#ts_style").val()

	this.config.autobop   = $("#ts_autobop").is(':checked')
	this.config.ping_pm   = $('#ts_ping_pm').is(':checked')
	this.config.ping_chat = $('#ts_ping_chat').is(':checked')
	this.config.ping_song = $('#ts_ping_song').is(':checked')
	this.config.chat_snag = $('#ts_chat_snag').is(':checked')

	window.localStorage.setItem("tsdb", JSON.stringify(this.config))
	$('#ts_pane').removeClass('active')
	this.__.log("saved config")
	this.loadThemes()
}

// build our options menu
tS.prototype.buildPanel = function() {
	// inject our CSS
	let link = document.createElement('link')
	link.rel = "stylesheet"; link.type = "text/css"
	link.href = `${this.base}/turnStyles.css`
	document.head.append(link)

	// the options window
	$('body').append(`
		<div id="ts_pane">
			<h2>turnStyles options</h2>

			<div class="full">
				<label>${this.handleBool('autobop')} Autobop</label>
			</div>
			<div class="half">
				<label>Theme</label>
				${this.handleOpts('theme')}
			</div>
			<div class="half">
				<label>Style</label>
				${this.handleOpts('style')}
			</div>
			<div class="half">
				<h3>Chat Info</h3>
				<label>${this.handleBool('chat_stat')} Stats In Chat</label>
				<label>${this.handleBool('chat_snag')} Snags In Chat</label>
				<label>${this.handleBool('chat_join')} Joins In Chat</label>
				<label>${this.handleBool('chat_gone')} Leaves In Chat</label>
			</div>
			<div class="half">
				<h3>Notifications</h3>
				<label>${this.handleBool('ping_pm')} On DMs</label>
				<label>${this.handleBool('ping_chat')} On Mentions</label>
				<label>${this.handleBool('ping_song')} On New Songs</label>
			</div>

			<button id="ts_close">Cancel</button>
			<button id="ts_save">Save</button>
		</div>
	`)
	// bind up the events
	$('#ts_save').on('click', this.saveConfig.bind(this))
	$('#ts_close').on('click', () => $('#ts_pane').removeClass('active'))

	this.addOpenBtn() // add the menu toggle
	this.volControl() // add our volume control
}
tS.prototype.addOpenBtn = function() {
	// add the button
	$('#layout-option').before(`
		<li class="ts link option">
			<a id="ts_open" href="#">turnStyles</a>
		</li>
	`)
	// clicking toggles the menu
	$('#ts_open').on('click', () => {
		$('#ts_pane').toggleClass('active')
	})
}
tS.prototype.volControl = function() {
	// add our slider
	$('.header-content').append(`
		<div id="ts_volume">
			<input id="ts_slider" type="range" min="0" max="100" value="100" />
		</div>
	`)
	// set up our connection to youtube
	$('#ts_slider').on('input', e => {
		window.youtube.setVolume(e.target.value)
	})
}
tS.prototype.handleOpts = function(list) {
	let data = this.__.options[list]
	let opts = `<option value="">None</option>`
	for (let key in data) {
		let curr = this.config[list] == key ? 'selected' : ''
		opts += `<option value="${key}" ${curr}>${data[key]}</option>`
	}
	return `<select id="ts_${list}">${opts}</select>`
}
tS.prototype.handleBool = function(data) {
	let checked = this.config[data] ? 'checked' : ''
	return `<input id="ts_${data}" type="checkbox" ${checked} />`
}

// load our styles and themes
tS.prototype.loadThemes = function() {
	this.refreshCSS("themes", this.config.theme)
	this.refreshCSS("styles", this.config.style)
}
tS.prototype.refreshCSS = function(type, name) {
	let curr = $(`link.tS-${type}`)
	let path = `${this.base}/${type}/${name}.css`
	if (!name) return curr.length ? curr.remove() : false
	this.__.log(`loading ${type}/${name}.css`)

	if (curr.length) curr.attr("href", path)
	else {
		let link = document.createElement('link')
		link.classList.add(`tS-${type}`)
		link.rel = "stylesheet"
		link.type = "text/css"
		link.href = path
		document.head.append(link)
	} 
}

// run our autobop (awesome)
tS.prototype.runAutobop = function() {
	if (this.autobop) clearTimeout(this.autobop)
	if (!this.config.autobop) return
	let roomId = this.room.roomId
	this.autobop = setTimeout(() => {
		$(window).focus()
		let options = { bubbles: true, cancelable: true, view: window }
		let awesome = document.querySelectorAll('.awesome-button')[0]
		let clicked = new MouseEvent('click', options)
		return !awesome.dispatchEvent(clicked)
	}, (Math.random() * 7) * 1000)
}

// handle our notifications
tS.prototype.notifyUser = function(data) {
	return window.postMessage({
		type: "tsNotify", notification: data
	})
}
tS.prototype.sendToChat = function(text, bold) {
	$('.chat .messages').append(`
		<div class="message">
			<em>
				${ bold ? `<span class="subject">${bold}</span>` : '' }
				<span class="text">${text}</span>
			</em>
		</div>
	`)
	this.core.topViewController.updateChatScroll()
}

// event handlers
tS.prototype.runEvents = function(e) {
	if (!e.command) return
	if (e.command == "pmmed") this.onNewPM(e)
	if (e.command == "speak") this.onNewChat(e)
	if (e.command == "newsong") this.onNewSong(e)
	if (e.command == "snagged") this.onNewSnag(e)
	if (e.command == "registered") this.onNewUser(e)
	if (e.command == "deregistered") this.onOldUser(e)
	if (e.command == "update_votes") this.onNewVote(e)
}
tS.prototype.onNewPM = function(e) {
	if (this.config.ping_pm && !window.tsPmPing) {
		this.notifyUser({ head: `New PM`, text: e.text })
		// only send one notification per ten seconds
		window.tsPmPing = setTimeout(() => {
			window.tsPmPing = null
		}, 10 * 1000)
	}
}
tS.prototype.onNewChat = function(e) {
	if (this.config.ping_chat && !window.tsChatPing) {
		let ping = `@${this.core.user.attributes.name}`
		if (e.text.indexOf(ping) > -1) this.notifyUser({
			head: `[${this.room.roomData.name}] @${e.name}`, text: e.text
		})
		// only send one notification every ten seconds
		window.tsChatPing = setTimeout(() => {
			window.tsChatPing = null
		}, 10 * 1000)
	}
}
tS.prototype.onNewSong = function(e) {
	this.runAutobop()

	// save the current as the last played
	if (!this.now_playing) this.last_played = {}
	else this.last_played = { ...this.now_playing }
	// set the current song to the new one
	this.now_playing = {
		love: 0, hate: 0, snag: 0,
		...e.room.metadata.current_song.metadata
	}
	
	let head = `Now Playing: ${this.now_playing.song}`
	let text = `By: ${this.now_playing.artist}`
	let stat = !this.last_played.song ? false : [
			`Last:`,
			`${this.last_played.love}🔺`,
			`${this.last_played.hate}🔻`,
			`${this.last_played.snag}❤️`,
			`${this.last_played.song}`
		].join(' ')

	if (this.config.chat_stat && stat) this.sendToChat(stat)
	if (this.config.ping_song) this.notifyUser({ head, text: stat || text })
}
tS.prototype.onNewSnag = function(e) {
	this.now_playing.snag += 1
	if (this.config.chat_snag) {
		let name = this.room.userMap[e.userid].attributes.name
		this.sendToChat(`has snagged this track!`, name)
	}
}
tS.prototype.onNewVote = function(e) {
	this.now_playing.love = e.room.metadata.upvotes
	this.now_playing.hate = e.room.metadata.downvotes
}
tS.prototype.onNewUser = function(e) {
	if (this.config.chat_join) {
		this.sendToChat(`joined.`, e.user[0].name)
	}
}
tS.prototype.onOldUser = function(e) {
	if (this.config.chat_gone) {
		this.sendToChat(`left.`, e.user[0].name)
	}
}

const $tS = window.$tS = new tS()