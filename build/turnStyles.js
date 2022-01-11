(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// attach.js | connect app to the turntable room

module.exports = app => {

	// attach (init) into the turntable room
	app.attach = function () {
		this.getConfig()
		const core = window.turntable
		if (!core) return this.Log('no room')
		const user = window.turntable.user

		// we can't attach if we're in the lobby
		this.lobby = $('#turntable #topBG').length
		if (this.lobby) return this.bindPanels()

		// we loop until the window has loaded the room fully
		const again = () => setTimeout(app.attach.bind(this), 150)

		if (!user) return again()
		let room = this._findKey(core, 'roomId')
		if (!room) return again()
		let full = this._findKey(room, 'roomData')
		if (!full) return again()

		// room loaded!
		this.listener = this.listen.bind(this)
		window.turntable.addEventListener('message', this.listener)

		this.Emit('attach', room)
		this.Log('loaded room')
	}

	// unload and reload turnStyles assets
	app.reload = function () {
		// unload turnStyles
		clearInterval(this.heart)
		window.turntable.removeEventListener('message', this.listener)
		$('script[src*="turnStyles.js"]').remove()

		// reload turnStyles
		const script = document.createElement('script')
		script.src = `${ this.__base }/turnStyles.js?v=${ Math.random() }`
		script.type = 'text/javascript'

		this.Log('reloading')
		document.body.append(script)
	}

}
},{}],2:[function(require,module,exports){
// events.js | trigger internal events

module.exports = app => {

	// bind functions to events 
	app.on = function (keys, ...list) {
		// define storage, ensure list
		if (!this.events) this.events = {}
		if (!Array.isArray(keys)) keys = [ keys ]
		// loop through our list of keys
		for (let key of keys) {
			if (!this.events[key]) this.events[key] = []
			// bind app to function, add to event storage
			for (let func of list) this.events[key].push(func.bind(this))
		}
	}

	// fire functions bound to events
	app.Emit = function (key, ...args) {
		let eventList = this.events[key]
		if (eventList) for (let func of eventList) func(...args)
	}

	// listen to turntable events
	app.listen = function (event) {
		if (!event.command) return
		// attach some data of our own
		event.$ping = this.$Ping(event.text)
		event.$name = this.$Name(event.userid)
		event.$from = this.$Name(event.senderid)
		event.$self = event.userid == this.$User().id

		// fire the event
		this.Emit(event.command, event)
	}

	// listen for DOM changes
	app.watcher = function () {
		let Observe = window.MutationObserver || window.WebKitMutationObserver
		let Watcher = new Observe(function(mutations) {
			for (let changed of mutations) {
				let el = changed.target
				// playlist updates
				if (el.className == "songs") app.Emit('playlist')
				// new chat messages
				if (el.className == "messages") app.Emit('newchat', el)
				// profile overlay
				if (el.nodeName == "TITLE" && el.baseURI.indexOf('profile/') > -1) {
					app.Emit('profile', el.baseURI.split('profile/')[1])
				}
			}
		})

		Watcher.observe(document, {  subtree: true, childList: true })
	}

	// bind watcher on attach
	app.on('attach', app.watcher)
}
},{}],3:[function(require,module,exports){
// global.js | helpers and utilities

module.exports = app => {

  app._now = () => new Date().toLocaleTimeString('en-us')
  app._cap = s => s[0].toUpperCase() + s.substring(1)

  // create a link element
  app._link = (id, url) => {
    let el = document.createElement('link'); el.id = id; 
    el.type = "text/css"; el.rel = "stylesheet"; el.href = url;
    return el
  }

  // create our user style element
  app._css = style => {
    let el = document.createElement('style'); el.id = "ts_css";
    el.type = "text/css"; el.innerHTML = style;
    return el
  }
  
  // toggle classes on the DOM
  app._class = (name, on) => {
    let has = $('body').hasClass(name)
    if (on && !has) $('body').addClass(name)
    if (has && !on) $('body').removeClass(name)
  }

  // fake click an element
  app._click = el => {
    $(window).focus()
    const opts = { bubbles: true, cancelable: true, view: window }
    const elem = document.querySelectorAll(el)[0]
    const fire = new MouseEvent('click', opts)
    return !elem.dispatchEvent(fire)
  }

  // clean strings
  app._clean = str => {
    // trim inserted URL file paths
    if (str.indexOf('inserted:') == 0) {
      let path = str.split('/')
      return `inserted: ${path[path.length - 1]}`
    }
    return str
  }

  // find prop by key in object
  app._findKey = (obj, key) => {
    const exists = o => o !== null && typeof o != "undefined" && o[key]
    for (let prop in obj) if (exists(obj[prop])) return obj[prop]
  }

}
},{}],4:[function(require,module,exports){
// layout.js | internal templating

module.exports = app => {

  app.$_post = obj => `
    <div class="message ${ obj.type || '' }"><em>
      <span class="subject">${ obj.head || '' }</span>
      <span class="text">${ obj.body || '' }</span>
    </em></div>
  `

  app.$_volume = val => `
    <div id="tsVolume">
      <span id="tsMute"></span>
      <input id="tsSlider" type="range" min="0" max="100" value="${ val }" />
      <em id="tsMuted">Muted For One Song</em>
    </div>
  `

  app.$_userLink = id => `
    <a target="_blank" class="statslink"
      onclick="$('.modal .close-x')[0].click()"
      href="https://thompsn.com/turntable/leaderboard/thing/?id=${ id }">
      Leaderboard
    </a>
  `

  // panel ui
  app.$_toggle = function (item, name, group, id) { 
    let value = group ? this.config[group][item] : this.config[item]
    return `
    <label class="ts-toggle" ${ id ? `id="${ id }"` : '' }>
      <input type="checkbox"
        data-opt="${ item }" 
        data-cat="${ group || "" }"
        ${ value ? 'checked' : '' } />
      <span></span> ${ name }
    </label>`
  }

  app.$_string = function (item, name, group) { 
    let value = group ? this.config[group][item] : this.config[item]
    return `
    <input type="text" class="ts-inputs"
      data-opt="${ item }" 
      data-cat="${ group || "" }" 
      value="${ value }" />
    ${ this.$_button(name, item) }`
  }

  app.$_bigtxt = function (item, name, group) {
    let value = group ? this.config[group][item] : this.config[item]
    return `
    <textarea class="ts-inputs" rows="10" 
      data-opt="${ item }" data-cat="${ group || "" }">${ value }</textarea>
    ${ this.$_button(name, item) }`
  }

  app.$_select = function (list, group) {
    let options = this.options[list]
    let current = group ? this.config[group][list] : this.config[list]
    return `
    <select class="ts-choice"
      data-opt="${ list }" data-cat="${ group || "" }">
      <option value="">No ${ this._cap(list) }</option>
      ${ Object.keys(options).map(opt => `
        <option value="${ opt }" ${ current == opt ? 'selected' : ''}>
          ${ options[opt] }
        </option>
      `).join('') }
    </select>`
  }

  app.$_qt_btn = function (i) { 
    let which = `qtbtn${i}`
    let qtext = this.config.qtbtns[which]
    let label = qtext.indexOf('||') > -1
    if (label) {
      qtext = qtext.split('||')
      label = qtext.shift()
      qtext = qtext.join(' ')
    } else {
      label = `QT${i}`
    }
    return this.$_button(label, false, which, which)
  }

  app.$_button = function (name, item, id, func) { return `
    <button class="ts-button" ${ id ? `id="${ id }"` : `` }
      ${ item ? `data-for="${ item }"` : `` }
      ${ func ? `onclick="$tS.${ func }()"` : `` }>
      ${ name }
    </button>`
  }

}
},{}],5:[function(require,module,exports){
// logger.js | print logs in console and room

module.exports = app => {

	// our main logger function
	app.Log = function (str) {
		// print the log in the console with timestamp
		console.info(`[${this._now()}] turnStyles :: ${str}`)
		
		// record to the logbook
		str = this._clean(str)
		this.logbook = this.logbook || []
		this.logbook.push(`[tS - ${this._now()}] <span>${str}</span>`)
		if (this.logbook.length > 50) this.logbook.shift()

		// update the logbook
		if (app.Logs()) {
			app.Logs().innerHTML = this.logbook.reverse().join('<br>')
			app.Logs().scrollTop = app.Logs().scrollHeight
		}
	}

	// logbook access
	app.Logs = () => $('#tsLogs')[0]

	// attach logbook to room tab
	app.on('attach', function attachLogBook () {
    $('#tsLogs').remove()
    $('.room-info-nav').after(`<div id="tsLogs"></div>`)
	})

	// automatic event logs
	app.on('update', function (key, val) {
		this.Log(`update: [${ key }] to (${ val })`)
	})
	
	app.on('registered', function joinLog (e) {
		for (let u of e.user) this.Log(`[${u.name}](${u.userid}) joined.`)
	})

	app.on('deregistered', function leftLog (e) {
		for (let u of e.user) this.Log(`[${u.name}](${u.userid}) left.`)
	})

	app.on('add_dj', function jumpLog (e) {
		let id = e.user[0].userid
		this.Log(`add dj: [${this.$Name(id)}](${id})`)
	})

	app.on('rem_dj', function dropLog (e) {
		let id = e.user[0].userid
		this.Log(`rem dj: [${this.$Name(id)}](${id})`)
	})

	app.on('update_votes', function voteLog (e) {
		let curr = e.room.metadata.votelog
		let vote = curr[curr.length - 1]
		this.Log(`[${this.$Name(vote[0])}] voted: ${vote[1]}`)
	})

}
},{}],6:[function(require,module,exports){
// notify.js | manage notifications

module.exports = app => {

  // send a desktop notification
  app.Notify = function (alert) {
    // Notify sends desktop notifications
    // but not if we can't, or we're on turntable
    if (!this.canNotify() || document.hasFocus()) return
    let { head, body, type } = alert, icon = this.__logo
    // add a function to refocus and close the notification
    let ding = () => {
      let sent = new Notification(head, { icon, body })
      sent.onclick = () => { window.focus(); sent.close() }
    }
    // if we have a type, delay it, therwise send
    return type ? this.delay(ding, 5, type) : ding()
  }

  // get desktop notificaiton permissions
  app.canNotify = function () {
    let cfg = this.config.notify
    // if we need to send notifications,
    // get the browser permission for it
    let has = cfg.chat || cfg.song || cfg.ding
    // return if no notifications possible
    if (!has || !('Notification' in window)) return false
    if (Notification.permission === 'denied') return false
    // prompt for the permission if default
    if (Notification.permission === 'default') {
      this.Log('requesting notifications')
      Notification.requestPermission()
      return false
    }
    // otherwise we have permissions
    return true
  }

  // check for perms on attach and update
  app.on(['attach', 'update'], app.canNotify)

}
},{}],7:[function(require,module,exports){
// panels.js | handle the hotbar/options panel

module.exports = app => {

  app.bindPanels = function () {
    this.drawHotBar()
    this.drawWindow()
  }

  app.drawHotBar = function () {
    $('#tsHotBar').remove()
    $('.header-bar').append(HotBar())

    $('#tsOpen').on('click', () => $('#tsWindow').addClass('active'))
    
    $('#tsHotBar *[data-for]').on('click',  this.saveConfig.bind(this))
    $('#tsHotBar *[data-opt]').on('change', this.saveConfig.bind(this))
  }

  app.drawWindow = function () {
    $('#tsWindow').remove()
    $('body').append(Options())

    $('#tsClose').on('click', () => $('#tsWindow').removeClass('active'))
    $('#tsWindow').on('click', function (e) {
      if (e.target == this) $('#tsWindow').removeClass('active')
    })

    $('.ts-tab').on('click', (e) => {
      $('#tsWindow .active').removeClass('active')
      $(`*[data-tab="${e.target.dataset.tab}"]`).addClass('active')
    })
    
    $('#tsWindow *[data-for]').on('click',  this.saveConfig.bind(this))
    $('#tsWindow *[data-opt]').on('change', this.saveConfig.bind(this))
  }

  const HotBar = () => `
    <div id="tsHotBar">
      ${ app.$_button('☰', false, 'tsOpen') }
      ${ app.$_toggle('is_afk', 'AFK', false, 'hbIsAfk') }
      ${ app.$_toggle('auto_b', 'AutoBop', false, 'hbAutoB') }
      ${ app.$_toggle('auto_q', 'AutoQueue', false, 'hbAutoQ') }
      ${ app.$_toggle('nextdj', 'Next DJ', false, 'hbNextDJ') }

      ${ app.$_qt_btn('1') }
      ${ app.$_qt_btn('2') }
      ${ app.$_qt_btn('3') }

      ${ app.$_toggle('bubble', 'Bubbles', false, 'hbBubbles') }
      ${ app.$_toggle('people', 'People', false, 'hbPeople') }
      ${ app.$_toggle('player', 'Player', false, 'hbPlayer') }
    </div>
  `

  const Options = () => `
    <div id="tsWindow">
      <div id="tsConfig">
        <nav>
          <h2><span id="tsClose">✖</span>turnStyles</h2>
          <div class="ts-tab active" data-tab="general">General</div>
          <div class="ts-tab" data-tab="visual">Visual</div>
          <div class="ts-tab" data-tab="hotbar">HotBar</div>
          <div class="ts-tab" data-tab="alerts">Alerts</div>
          <div class="ts-tab" data-tab="support">Help / About</div>
        </nav>

        ${ General() }
        ${ Visuals() }
        ${ HBarTab() }
        ${ Alerts() }
        ${ Support() }
      </div>
    </div>
  `
  const General = () => `
    <div data-tab="general" class="ts-tabbed active">
      <h3>Automate</h3>

      <h5>${ app.$_toggle('auto_b', 'Enable Autobop') }</h5>
      <p>Vote "Awesome" after every new song starts, automatically!</p>

      <h5>${ app.$_toggle('nextdj', 'Take Next DJ Spot') }</h5>
      <p>With this selected, turnStyles will attempt to automatically add you as a DJ when a spot becomes available.</p>

      <h5>${ app.$_toggle('auto_q', 'Enable AutoQueue') }</h5>
      ${ app.$_string('q_text', 'Save Ping')}
      <p>Have a bot in your room that uses a queue? Copy/paste your queue ping above to automatically jump on deck when you're called!</p>

      <h3>General</h3>

      <h5>${ app.$_toggle('is_afk', 'Currently AFK') }</h5>
      ${ app.$_string('afkstr', 'Save AFK Text') }
      <p>When you've marked yourself as AFK, it will send the AFK Text above, and it will send it again whenever you're pinged while AFK.</p>

      <h5>${ app.$_toggle('volume', 'Override Volume') }</h5>
      <p>Move the volume controls to the main header (out of the menu), and add Temporary Mute (until the next song).</p>
    </div>
  `
  const Visuals = () => `
    <div data-tab="visual" class="ts-tabbed">
      <h3>Theme/Style</h3>
      ${ app.$_select('theme') }
      ${ app.$_select('style') }

      <h3>Visual Tweaks</h3>
      <h5>${ app.$_toggle('played', 'Show Recently Played') }</h5>
      <p>Checks your playlist and highlights songs recently played in the current room.</p>
      <h5>${ app.$_toggle('stamps', 'Add Timestamps To Chat') }</h5>
      <p>Adds a timestamp to the top right of room chat messages.</p>

      <h3>Turntable</h3>
      ${ app.$_toggle('bubble', 'Show Chat Bubbles') }
      ${ app.$_toggle('people', 'Show Room Audience') }
      ${ app.$_toggle('player', 'Show Video Player') }

      <h3>Custom CSS</h3>
      ${ app.$_bigtxt('u_css', 'Save & Apply Styles!') }
      <p>Add your own custom CSS snippets to turntable!</p>
    </div>
  `
  const HBarTab = () => `
    <div data-tab="hotbar" class="ts-tabbed">
      <h3>QuickText</h3>
      <h5>${ app.$_toggle('qtbtn1', 'Enable QT 1', 'hotbar') }</h5>
      ${ app.$_string('qtbtn1', 'Save QT 1', 'qtbtns')}
      <p>Send your most common messages at the push of a button!</p>

      <h5>${ app.$_toggle('qtbtn2', 'Enable QT 2', 'hotbar') }</h5>
      ${ app.$_string('qtbtn2', 'Save QT 2', 'qtbtns')}
      <p>Add a button label by splitting your message with <strong>||</strong>.<br />e.g. <kbd>Hello || Hello There</kbd></p>

      <h5>${ app.$_toggle('qtbtn3', 'Enable QT 3', 'hotbar') }</h5>
      ${ app.$_string('qtbtn3', 'Save QT 3', 'qtbtns')}
      <p>Send multiple messages by splitting with <strong>;;</strong>.<br />e.g. <kbd>Welcome || (Hello!) ;; (Rules!) ;; (Gif!)</kbd><br /><em>(Only 3 messages may be sent per QuickText)</em></p>
        
      <h3>Default</h3>
      ${ app.$_toggle('is_afk', 'AFK in Hot Bar', 'hotbar') }
      ${ app.$_toggle('auto_b', 'Autobop in Hot Bar', 'hotbar') }
      ${ app.$_toggle('auto_q', 'AutoQueue in Hot Bar', 'hotbar') }
      ${ app.$_toggle('nextdj', 'Next DJ in Hot Bar', 'hotbar') }
      ${ app.$_toggle('bubble', 'Chat Bubble Toggle in Hot Bar', 'hotbar') }
      ${ app.$_toggle('people', 'Audience Toggle in Hot Bar', 'hotbar') }
      ${ app.$_toggle('player', 'Player Toggle in Hot Bar', 'hotbar') }
    </div>
  `
  const Alerts = () => `
    <div data-tab="alerts" class="ts-tabbed">
      <h3>Hot Words</h3>
      ${ app.$_string('text', 'Save Hot Words', 'notify') }
      <p>Sends Desktop Notifications/Highlights word match in chat. Use multiple words as a comma separated list.</p>

      <h3>Notify</h3>
      ${ app.$_toggle('song', 'Notify On New Songs', 'notify') }
      ${ app.$_toggle('chat', 'Notify On New DMs', 'notify') }
      ${ app.$_toggle('ding', 'Notify On Mentions', 'notify') }
      <p>Sends Desktop Notifications.</p>

      <h3>Alert</h3>
      ${ app.$_toggle('song', 'Last Song Stats', 'alerts') }
      ${ app.$_toggle('spun', 'Last DJ Stats', 'alerts') }
      ${ app.$_toggle('snag', 'For User Snags', 'alerts') }
      ${ app.$_toggle('join', 'On User Joins', 'alerts') }
      ${ app.$_toggle('left', 'On User Leave', 'alerts') }
      <p>These alerts show up in the room chat and are only visible to you, not for everyone to see.</p>
    </div>
  `
  const Support = () => `
    <div data-tab="support" class="ts-tabbed ts-about">
      <h3>Debug</h3>
      ${ app.$_toggle('logger', 'Show Logs In Room Tab') }
      ${ app.$_button('Reload turnStyles', false, false, 'reload') }
      ${ app.$_button('Reload Players', false, false, 'reloadMusic') }

      <h3>Support</h3>
      <a class="ts-button" target="_blank" href="https://discord.gg/wqmAVvgSbE">
        turnStyles Discord
      </a>
      <a class="ts-button" target="_blank" href="https://discord.gg/jnRs4WnPjM">
        turntable.fm Discord
      </a>

      <h3>Sharing</h3>
      <a class="ts-button" target="_blank" href="https://chrome.google.com/webstore/detail/turntable-tweaks/pmlkackfnbbnjfejpddpakallilkbdme">Chrome / Opera</a>
      <a class="ts-button" target="_blank" href="https://addons.mozilla.org/en-US/firefox/addon/turnstyles-for-turntable-fm/">Firefox</a>
      <a class="ts-button" target="_blank" href="https://ts.pixelcrisis.co">Bookmarklet</a>
      <a class="ts-button" target="_blank" href="https://ts.pixelcrisis.co">Beta</a>

      <h3>Author</h3>
      <em>turnStyles v${ app.config.version }<em><br />
      <strong>@crisis</strong> on Discord<br />
      <strong>@crisis</strong> on Turntable<br />
      <a target="_blank" href="https://patreon.com/pixelcrisis">patreon.com/pixelcrisis</a><br />
      <em>Request Themes & More on Patreon!</em>
    </div>
  `

  app.on('attach', app.bindPanels)

}
},{}],8:[function(require,module,exports){
// timing.js | internal loop and delays

module.exports = app => {

	app.bindTimer = function () {
		this.holding = {}
		this.heart = setInterval(app.beat.bind(this), 60 * 1000)
	}

	// delay a function from firing if fired recently
	app.delay = function (func, delay, key) {
		// suspend func for delay seconds
		// used to prevent spam from notifications, etc
		if (!this.holding) this.holding = {}
		// if we're already delayed, just ignore
		if (this.holding[key]) return

		// self-clearing timeout
		let timeout = delay * 1000
		let cleared = () => { delete this.holding[key] }
		this.holding[key] = setTimeout(cleared.bind(this), timeout)

		// fire our function
		if (func) func()
	}

	// the heartbeat fired every minute
	app.beat = function () {
		// emit 'heartbeat' every minute
		this.config.timing.beat = parseInt(this.config.timing.beat) + 1
		this.Emit('heartbeat', this.config.timing.beat)
	}

	// start loop and delay storage on attach
	app.on('attach', app.bindTimer)

}
},{}],9:[function(require,module,exports){
// ttlink.js | interacting with turntable

module.exports = app => {

	// quick access to turntable room data
	app.$User = () => window.turntable.user
	app.$View = () => window.turntable.topViewController
	app.$Chat = () => window.turntable.buddyList.pmWindows
	app.$Room = () => window.turntable.topViewController.roomData

	// find username from id
	app.$Name = (id = 'Unknown') => {
		// check the room first
		let user = app.$View().userMap[id]
		if (user) return user.attributes.name
		// then check PMs
		if (app.$Chat() && app.$Chat()[id]) {
			return app.$Chat()[id].otherUser.attributes.name
		}
		return id
	}

	// check for mention
	app.$Ping = (str = '') => {
		let ping = `@${app.$User().attributes.name}`
		return str.toLowerCase().indexOf(ping.toLowerCase()) > -1
	}

  // "silent" messages posted in chat
  app.$Post = function (alert) {
    $('.chat .messages').append(this.$_post(alert))
    this.$View().updateChatScroll()
  }

  // send a message to the room
  app.$Send = function (text) {
    let roomid = this.$View().roomId
    let section = this.$View().section
    window.turntable.sendMessage({
      text, api: 'room.speak', roomid, section
    })
  }

}
},{}],10:[function(require,module,exports){
// config.js | the default config objects

module.exports = app => {

	app.default = {
		theme: "dark",
		style: "",
		u_css: "",

		is_afk: false,
		afkstr: "I'm AFK - Back in a sec!",

		people: true,
		player: true,
		bubble: true,

		logger: false,
		volume: false,
		played: false,
		stamps: false,

		auto_b: true,
		nextdj: false,
		auto_q: false,
		q_text: "Hey @user - it's your turn!",

		notify: {
			song: false,
			ding: false,
			chat: false,
			text: ""
		},

		alerts: {
			song: false,
			spun: false,
			snag: false,
			join: false,
			left: false
		},

		hotbar: {
			is_afk: true,
			auto_b: true,
			auto_q: true,
			nextdj: true,
			bubble: false,
			people: false,
			player: false,
			qtbtn1: false,
			qtbtn2: false,
			qtbtn3: false
		},

		qtbtns: {
			qtbtn1: "",
			qtbtn2: "",
			qtbtn3: ""
		},

		timing: {
			beat: 0,
			post: 0,
			text: "Today's theme is: Cool."
		},
	}

	app.options = {
		theme: {
			dark: "Dark Mode",
			night: "Night Mode",
			cosmic: "Cosmic",
			midnight: "Midnight"
		},
		style: {
			blue: "Blue",
			pink: "Pink",
			purple: "Purple",
			teal: "Teal"
		},
		remind: {
			0: "Don't Remind",
			15: "Every 15m",
			30: "Every 30m",
			60: "Every 1h",
			120: "Every 2h"
		}
	}

}
},{}],11:[function(require,module,exports){
// session.js | handles storing tt data

module.exports = app => {

	app.buildCache = function (room) {
		// define our cache storage
		this.current_djs = {}
		this.now_playing = {}
		this.last_played = {}
		// and cache anything we find
		for (let id of room.djids) this.cacheDJ(id)
		this.cacheSong(room.currentSong)
	}

	// manage stats cache
	const cache = (curr = {}, data = {}) => {
		let base = { spun: 0, love: 0, hate: 0, snag: 0 }
		for (let p in curr) if (p in base) base[p] += curr[p]
		for (let p in data) if (p in base) base[p] += data[p]
		return base
	}
	// cache string template
	const stats = (obj, str = '') => {
		if (obj && "love" in obj) str += `${obj.love}❤️`
		if (obj && "hate" in obj) str += `${obj.hate}💔`
		if (obj && "snag" in obj) str += `${obj.snag}💖`
		if (obj && "spun" in obj) str += `${obj.spun}▶️`
		return str
	}

	// DJ Sessions
	app.cacheDJ = function (e) {
		let user = e.user ? e.user[0].userid : e
		let curr = this.current_djs[user]
		if (!curr) this.current_djs[user] = cache()
	}
	app.resetDJ = function (e) {
		let user = e.user[0].userid
		let stat = stats(this.current_djs[user])
		delete this.current_djs[user]
		this.Emit('dropped', e.user[0].name, stat)
	}

	// Song Sessions
	app.cacheSong = function (e) {
		// cache songs on attach and by event
		let song = e && e.room ? e.room.metadata.current_song : e
		let love = e && e.upvoters ? e.upvoters.length : 0
		let djid = song ? song.djid : false

		// update now playing and last played
		let last = { ...this.now_playing }
		let base = { love, hate: 0, snag: 0, dj: djid }
		this.now_playing = song ? { ...song.metadata, ...base } : {}
		this.last_played = last

		// update the associated DJ
		let data = { ...last, spun: 1 }, curr = this.current_djs[last.dj]
		if (data.song && curr) this.current_djs[last.dj] = cache(curr, data)

		this.Log(`new song: ${ this.now_playing.song || 'none' }`)
		this.Emit('tracked', stats(last))
	}

	app.cacheSnag = function () { this.now_playing.snag += 1 }
	app.cacheVote = function (e) {
		this.now_playing.love = e.room.metadata.upvotes
		this.now_playing.hate = e.room.metadata.downvotes
	}

	// bind our cache events
	app.on('attach', app.buildCache)
	app.on('add_dj', app.cacheDJ)
	app.on('rem_dj', app.resetDJ)
	app.on('nosong', app.cacheSong)
	app.on('newsong', app.cacheSong)
	app.on('snagged', app.cacheSnag)
	app.on('update_votes', app.cacheVote)

}
},{}],12:[function(require,module,exports){
// storage.js | saving our configs

module.exports = app => {

	// build config from defaults and local storage
	app.getConfig = function () {
		// only load the base config once
		if (this.__base) return
		this.__base = window.tsBase || 'https://ts.pixelcrsis.co/build'
		this.__logo = `${this.__base}/images/icon128.png`
		// load any saved user configs
		let storage = window.localStorage.getItem('tsdb')
		let configs = storage ? JSON.parse(storage) : {}
		let version = require('../package.json').version
		// load and apply our defaults
		let is_afk  = false // can't be afk if we're loading
		this.config = { ...this.default, ...configs, version, is_afk }
		this.update()

		this.Emit('loaded', this.config)
	}

	// save config to local storage
	app.saveConfig = function (e) {
		let self = e.target
		let data = self.dataset
		if (!data.opt && !data.for) return

		let which = data.for || data.opt
		let check = self.type == 'checkbox'
		let value = check ? self.checked : self.value
		if (data.for) value = $(`*[data-opt="${ which }"]`).val()

		// save the updated config 
		this.setConfig(which, value, data.cat)
		// emit that the change was updated
		let visual = [ 'style', 'theme', 'user_css' ].includes(which)
		if ([ 'hotbar', 'macros'].includes(data.cat)) visual = true
		if (visual || !this.lobby) this.Emit('update', which, value, data.cat)
		// only emit visual changes in the lobby
	}

	// update a config item
	app.setConfig = function (opt, val, group) {
		// update config object
		if (!group) this.config[opt] = val
		else this.config[group][opt] = val
		// save the updated config locally
		let stored = JSON.stringify(this.config)
		window.localStorage.setItem('tsdb', stored)
		// mirror the option between window/hotbar
		let toggle = typeof val === 'boolean'
		let mirror = $(`*[data-opt="${opt}"][data-cat="${ group || ""}"]`)
		mirror.prop(toggle ? 'checked' : 'value', val)
	}

}
},{"../package.json":23}],13:[function(require,module,exports){
// updates.js | config layout migrations

module.exports = app => {

	const updates = [
		function UpgradeV10 (config) {
			// update old values to new mapped values
			const update = (old, map, deep, flip) => {
				if (old in config) {
					if (!deep) config[map] = flip ? !config[old] : config[old]
					else config[map][deep] = flip ? !config[old] : config[old]
					delete config[old]
				}
			}

			update('user_css', 'u_css')

			update('autobop', 'auto_b')
			update('logging', 'logger')
			update('has_vol', 'volume')

			update('q_ping', 'q_text')
			update('afk_ping', 'afkstr')

			update('no_aud', 'people', false, true)
			update('no_vid', 'player', false, true)
			update('no_bub', 'bubble', false, true)

			update('ping_pm',   'notify', 'chat')
			update('ping_song', 'notify', 'song')
			update('ping_chat', 'notify', 'ding')
			update('hot_words', 'notify', 'text')

			update('chat_song', 'alerts', 'song')
			update('chat_spun', 'alerts', 'spun')
			update('chat_snag', 'alerts', 'snag')
			update('chat_join', 'alerts', 'join')
			update('chat_left', 'alerts', 'left')

			update('beats',    'timing', 'beat')
			update('remind',   'timing', 'post')
			update('reminder', 'timing', 'text')

			return config
		}
	]

	app.update = function () {
		for (let update of updates) {
			this.config = update(this.config)
		}
	}

}
},{}],14:[function(require,module,exports){
// afk.js | respond to dings with an AFK message

module.exports = app => {

  // set afk status on update
  app.setAfk = function (key, val, grp) {
    if (key != 'is_afk' || grp) return
    // send our afk ping if enabled
    let msg = this.config.afkstr
    if (val && msg) this.$Send(msg)
  }

  // handle user being afk/active
  app.getAfk = function (e) {
    let { is_afk, afkstr } = this.config
    if (!is_afk || !afkstr) return

    if (!e.$self && e.$ping) this.$Send(afkstr)
    else if (e.$self && e.text != afkstr) {
      this.setConfig('is_afk', false)
      this.$Post({
        head: `Welcome Back!`,
        body: `You're no longer AFK!`
      })
    }
  }

  app.on('speak', app.getAfk)
  app.on('update', app.setAfk)

}
},{}],15:[function(require,module,exports){
// alerts.js | sending data to chat/notifications

module.exports = app => {

  app.notifyPMs = function (e) {
    if (this.config.notify.chat) this.Notify({
      head: `New PM ${e.$from ? `from: ${e.$from}` : ''}`,
      body: e.text, type: 'pm_ping'
    })
  }

  app.notifyDings = function (e) {
    if (this.config.notify.ding && e.$ping) this.Notify({
      head: `[${this.view().roomData.name}] @${e.name}`,
      body: e.text, type: 'chat_ping'
    })
    this.notifyText(e)
  }

  app.notifySong = function () {
    let curr = this.now_playing
    if (this.config.notify.song && curr.song) this.Notify({
      head: `Now Playing: ${curr.song}`, body: `By: ${curr.artist}`
    })
  }

  app.notifyText = function (e) {
    let match = e.text.toLowerCase()
    let words = this.config.notify.text.toLowerCase().split(",")
    for (let word of words) if (match.indexOf(word.trim()) > -1) {
      return this.Notify({ head: `Hot Word: "${ word }"`, body: e.text })
    }
  }

  app.alertSnags = function (e) {
    if (this.config.alerts.snag) this.$Post({
      head: e.$name, body: `has snagged this track!`, type: 'snag'
    })
  }

  app.alertJoin = function (e) {
    if (this.config.alerts.join) for (let user of e.user) this.$Post({
      head: user.name, body: 'joined.', type: 'join'
    })
  }

  app.alertLeft = function (e) {
    if (this.config.alerts.left) for (let user of e.user) this.$Post({
      head: user.name, body: 'left.', type: 'left'
    })
  }

  app.on('pmmed', app.notifyPMs)
  app.on('speak', app.notifyDings)
  app.on('tracked', app.notifySong)
  app.on('snagged', app.alertSnags)
  app.on('registered', app.alertJoin)
  app.on('deregistered', app.alertLeft)

}
},{}],16:[function(require,module,exports){
// auto.js | our automatic functions

module.exports = app => {

  app.autoBop = function () {
    if (this.bop) clearTimeout(this.bop)
    if (!this.config.auto_b) return

    const delay = (Math.random() * 7) * 100
    const click = () => this._click('.awesome-button')
    this.bop = setTimeout(click, delay)
  }

  // nextdj features
  app.autoJump = function () {
    if (!this.config.nextdj) return
    const button = $('.become-dj').length
    if (!button) return this.Log('nextdj: no spot')
    this.Log('nextdj: attempting jump')
    this.$View().becomeDj()
  }
  app.spinning = function (e) {
    if (!this.config.nextdj) return
    if (this.$User().id != e.user[0].userid) return

    this.setConfig('nextdj', false)
    const head = "You've hopped on deck!"
    const body = "NextDJ is now disabled."
    this.Notify({ head, body })
    this.$Post({ head, body })
  }

  // autoqueue - jump on queue ping
  app.autoQueue = function (e) {
    if (!this.config.auto_q) return
    if (this.config.q_text == e.text) this.$View().becomeDj()
  }

  // automatic timed reminders
  app.autoRemind = function (ran) {
    if (!this.config.timing.text) return
    let freq = parseInt(this.config.timing.post)
    let text = `[${this.$Room().name}] ${this.config.timing.text}`
    // ran divisible by freq (eg, on 120 ran for every 60 freq)
    if ((ran % freq) === 0 && this.config.timing.text) this.$Send(text)
  }

  app.on(['attach', 'newsong'], app.autoBop)
  app.on(['attach', 'update', 'rem_dj'], app.autoJump)
  app.on(['speak', 'pmmed'], app.autoQueue)
  app.on('add_dj', app.spinning)
  app.on('heartbeat', app.autoRemind)

}
},{}],17:[function(require,module,exports){
// chatbox.js | modifying the chatbox

module.exports = app => {

  app.qtbtn1 = function () { this.qtbtns('1') }
  app.qtbtn2 = function () { this.qtbtns('2') }
  app.qtbtn3 = function () { this.qtbtns('3') }
  app.qtbtns = function (i) {
    let text = this.config.qtbtns[`qtbtn${i}`]
    let name = `QT${i}`
    if (!text) return

    if (text.indexOf('||') > -1) {
      text = text.split('||')
      name = text.shift().trim()
      text = text.join('').trim()
    }

    text = text.split(';;')

    if (text.length > 3) {
      let head = "QuickText Error!"
      let body = `${name} message contains ${text.length}/3 messages.`
      this.$Post({ head, body })
    }
    
    else for (let msg of text) this.$Send(msg.trim())
  }

  // fade out 'started playing' 
  app.fadeNewSong = function (el) {  
    let last = $(el).children('.message').last()
    let user = last.has('.avatar').length
    let text = last[0].innerText.includes('started playing')
    if (!user && text) last.addClass('stat')
  }

  // add timestamps to new chats
  app.addTimeStamp = function (e) {
    if (!this.config.stamps) return
    let message = $('.chat .messages .message:last-of-type')
    let matches = message[0].innerText.indexOf(e.name) === 0
    let stamped = message.has('.timestamp').length

    if (!stamped && matches) {
      let _time = new Date().toLocaleTimeString('en-US')
      let stamp = _time.split(':').slice(0, 2).join(':')

      message.prepend(`<div class="timestamp">${stamp}</div>`)
    }
  }

  app.on('newchat', app.fadeNewSong)
  app.on('speak', app.addTimeStamp)

}
},{}],18:[function(require,module,exports){
// playlist.js | modifying the playlist

module.exports = app => {

  // bind and manage our playlist features
  app.watchPlaylist = function () {
    this.countPlaylist()
    this.checkPlaylist()
    this._class('played', this.config.played)
    // replace the 'upload' button with an organize one
    $('#upload-button').after(`<div id="tsUpload"></div>`)
    $('#tsUpload').on('click', this.orderPlaylist)
  }

  // replace "upload" with "organize"
  // literally just a clone of the tt function
  app.orderPlaylist = function () {
    if (window.playlist.isFiltering) window.playlist.clearSearchBar()
    $('#queue-header').removeClass('normal').addClass('edit')
    window.playlist.queue.batchEditMode()
  }

  // display song count in playlist header
  app.countPlaylist = function () {
    let head = $('#playlist-header .text')[0]
    let data = window.playlist.fileids.length
    let name = head.innerHTML.split('<em>')[0]
    head.innerHTML = `${name} <em>${data}</em>`
  }

  // highlight any recently played songs
  app.checkPlaylist = function () {
    $('.song.ts_played').removeClass('ts_played')
    if (!this.config.played) return

    let list = this.$Room().metadata.songlog
    $('#queue .songs .song').each(function () {
      let elem = $(this)
      let name = elem.find('.title').text()
      let band = elem.find('.details').text().split(' • ')[0]
      for (let item of list) {
        let { song, artist } = item.metadata
        if (song == name && artist == band) elem.addClass('ts_played')
      }
    })
  }
  app.togglePlayed = function (key, val) {
    if (key == 'played') this._class('played', val)
  }

  // bind our playlist features
  app.on('attach', app.watchPlaylist)
  app.on('update', app.togglePlayed)
  app.on('playlist', app.countPlaylist)
  app.on(['tracked', 'playlist'], app.checkPlaylist)
}
},{}],19:[function(require,module,exports){
// profile.js | modifying the user profile

module.exports = app => {

  // add ttstats link to user profiles
  app.linkUserStats = function (id) {  
    if ($('.profile.modal .statslink').length) return
    // force the web links section to be visible
    $('.profile.modal .section.web-links').show()
    $('.profile.modal .website').append(this.$_userLink(id))
  }

  app.on('profile', app.linkUserStats)

}
},{}],20:[function(require,module,exports){
// stats.js | tracking and posting song/dj stats

module.exports = app => {

  app.songStats = function (stat) {
    let last = this.last_played
    if (this.config.alerts.song && stat) this.$Post({
      head: stat,
      body: `${last.song} by ${last.artist}`,
      type: 'stat'
    })
  }

  app.djStats = function (name, stat) {
    if (this.config.alerts.spun) this.$Post({
      head: `${name} - ${stat}`,
      body: ` - is done spinning!`,
      type: 'stat'
    })
  }

  app.on('tracked', app.songStats)
  app.on('dropped', app.djStats)

}
},{}],21:[function(require,module,exports){
// themes.js | handles loading/reloading themes/styles

module.exports = app => {

  app.loadThemes = function (config) {
    // remove them in case we're reloading
    $('#ts_core, #ts_themes, #ts_styles, #ts_css').remove()

    this.insert('turnStyles')
    this.insert(config.theme, 'themes')
    this.insert(config.style, 'styles')
    this.inject(config.u_css)
    this.themed(config.theme)

    this._class('logger', config.logger)
    this._class('no_bub', !config.bubble)
    this._class('no_vid', !config.player)
    this._class('no_aud', !config.people)

    this._class('hb-is_afk', !config.hotbar.is_afk)
    this._class('hb-auto_b', !config.hotbar.auto_b)
    this._class('hb-auto_q', !config.hotbar.auto_q)
    this._class('hb-nextdj', !config.hotbar.nextdj)
    this._class('hb-bubble', !config.hotbar.bubble)
    this._class('hb-people', !config.hotbar.people)
    this._class('hb-player', !config.hotbar.player)
    this._class('hb-qtbtn1', !config.hotbar.qtbtn1)
    this._class('hb-qtbtn2', !config.hotbar.qtbtn2)
    this._class('hb-qtbtn3', !config.hotbar.qtbtn3)
  }

  app.updateThemes = function (key, val, grp) {
    if (key == 'theme') this.themed(val)
    if (key == 'theme') this.insert(val, 'themes')
    if (key == 'style') this.insert(val, 'styles')
    if (key == 'u_css') this.inject(val)
      
    if (key == 'bubble') this._class('no_bub', !val)
    if (key == 'player') this._class('no_vid', !val)
    if (key == 'people') this._class('no_aud', !val)
    if (key == 'logger') this._class('logger', val)

    if (grp == "hotbar") {
      if (key == "is_afk") this._class('hb-is_afk', !val)
      if (key == "auto_b") this._class('hb-auto_b', !val)
      if (key == "auto_q") this._class('hb-auto_q', !val)
      if (key == "nextdj") this._class('hb-nextdj', !val)
      if (key == "bubble") this._class('hb-bubble', !val)
      if (key == "people") this._class('hb-people', !val)
      if (key == "player") this._class('hb-player', !val)
      if (key == "qtbtn1") this._class('hb-qtbtn1', !val)
      if (key == "qtbtn2") this._class('hb-qtbtn2', !val)
      if (key == "qtbtn3") this._class('hb-qtbtn3', !val)
    }

    if (grp == "hotbar" || grp == "qtbtns") {
      this.drawHotBar()
    }
  }

  // inject css styles into the DOM
  app.inject = function (style) {
    let el = $('#ts_css')
    if (el.length) el[0].innerHTML = style
    else document.head.append(this._css(style))
    if (style) this.Log(`injected: ${style}`)
  }

  // insert or update link to our CSS files
  app.insert = function (file, folder) {
    let id = `ts_${ folder || 'core' }`
    let el = $(`#${ id }`)

    // piece together our base URL using folder
    let base = `${this.__base}${ folder ? `/${folder}` : ''}`
    let path = file ? `${base}/${file}.css?v=${Math.random()}` : '#'
    // create the link if it doesn't exist
    if (!el.length) document.head.append(this._link(id, path))
    else el.attr('href', path)

    if (path != "#") this.Log(`inserted: ${path.split('?v')[0]}`)
  }

  // record active theme on the body element
  app.themed = function (theme) {
    this._class('th-none', !theme)
    let last = $('body').data('theme')
    if (last) $('body').removeClass(`th-${last}`)
    if (theme) $('body').addClass(`th-${theme}`)
    $('body').data('theme', theme)
  }

  app.on('loaded', app.loadThemes)
  app.on('update', app.updateThemes)

}
},{}],22:[function(require,module,exports){
// volume.js | replace the turntable volume

module.exports = app => {
	// why doesn't turntable use standard linear volumes?
	const convertVol = x => Math.log(x / 100) / Math.LN2 + 4
	const currentVol = e => {
		// get the volume (in real numbers) from tt
		let curr = e || window.util.getSetting('volume')
		return 100 * Math.pow(2, curr - 4)
	}
	// get the volume from tt, but make it spicy
	const naturalVol = () => convertVol(currentVol())

	// load volume functionality
	app.loadVolume = function () {
		let opt = this.config.volume
		let has = $('body').hasClass('ts_vol')
		this._class('ts_vol', opt)

		// stash a copy of realVolume
		let rV = window.turntablePlayer.realVolume
		if (!this.realVolume) this.realVolume = rV

		// turn volume control on or off 
		if (opt && !has) this.addVolume()
		if (has && !opt) this.remVolume()
	}

	// inject our volume UI into tt
	app.addVolume = function () {
		$('.header-content').append(this.$_volume(currentVol()))
		// bind up our events
		const scroll = 'DOMMouseScroll mousewheel'
		$('#tsMute')  .on('click', this.muteVolume.bind(this))
		$('#tsSlider').on('input', this.saveVolume.bind(this))
		$('#tsSlider').on( scroll, this.rollVolume.bind(this))
	}

	// remove our volume UI from tt
	app.remVolume = function () {
		$('#tsVolume').remove()
		window.turntablePlayer.realVolume = this.realVolume
	}

	// update volume on ts volume change
	app.saveVolume = function (vol) {
		vol = vol.target ? vol.target.value : vol
		let volume = vol > 0 ? convertVol(vol) : -3
		// turntable doesn't natively go lower than 7
		let volFunc = volume < 7 ? currentVol : this.realVolume
		window.turntablePlayer.realVolume = volFunc
		window.turntablePlayer.setVolume(volume)
		window.util.setSetting('volume', volume)
	}

	// handle scrolling on volume slider
	app.rollVolume = function (e) {
		let curr = currentVol()
		let down = e.originalEvent.deltaY > 0
		// step volume by 5 vs 1 if holding shift
		let step = e.originalEvent.shiftKey ? 1 : 5
		let save = down ? (curr - step) : (curr + step)
		save = save < 0 ? 0 : save > 100 ? 100 : save

		$('#tsSlider')[0].value = save
		this.saveVolume(save)
		return false // don't interrupt event flow
	}

	// temp mute on volume icon click
	app.muteVolume = function () {
		// toggle mute on/off
		this.muted = !this.muted
		this._class('ts_muted', this.muted)
		let vol = this.muted ? -3 : naturalVol()
		window.turntablePlayer.setVolume(vol)

		this.Log(`turned mute ${ this.muted ? 'on' : 'off' }`)
	}

	// unmute after every song
	app.checkMuted = function () {
		if (this.muted) this.muteVolume()
	}

	// reload music players
	app.fixMusic = () => {
		let yt = window.youtube
		let sc = window.soundcloudplayer

		// update the song delay as time of refresh
		// then resume the song to force an update
		if (sc.song) {
			sc.songTime = sc.player.currentTime() / 1e3
			sc.previewStartTime = Date.now() - 1000
			sc.resumeSong(sc.song)
		}

		if (yt.song) {
			yt.songTime = yt.player[0].getCurrentTime()
			yt.previewStartTime = Date.now() - 3000
			yt.resumeSong(yt.song)
		}

		// close the panel on finish
		$('#tsPanel').removeClass('active')
	}

	// bind our volume events
	app.on('attach',  app.loadVolume)
	app.on('update',  app.loadVolume)
	app.on('nosong' , app.checkMuted)
	app.on('newsong', app.checkMuted)

}
},{}],23:[function(require,module,exports){
module.exports={
  "name": "turnStyles",
  "version": "9.9.9",
  "main": "turnStyles.js",
  "repository": "git@github.com:pixelcrisis/turntable-tweaks.git",
  "author": "pixelcrisis <pxcrisis@gmail.com>",
  "license": "MIT",
  "scripts": {
    "start": "yarn build && yarn watch",
    "build": "yarn b:core && yarn b:theme && yarn b:style && yarn b:static",
    "watch": "concurrently \"yarn w:1\" \"yarn w:2\" \"yarn w:3\" \"yarn w:4\"",
    "b:core": "yarn b:core:1 && yarn b:core:2 && yarn b:core:3",
    "b:core:1": "browserify -p tinyify turnStyles.js -o build/turnStyles.js",
    "b:core:2": "node-sass turnStyles.sass -o build",
    "b:core:3": "postcss build/turnStyles.css --use autoprefixer -d build/",
    "b:theme": "yarn b:theme:1 && yarn b:theme:2",
    "b:theme:1": "node-sass sass/themes -o build/themes",
    "b:theme:2": "postcss build/themes/*.css --use autoprefixer --d build/themes",
    "b:style": "yarn b:style:1 && yarn b:style:2",
    "b:style:1": "node-sass sass/styles -o build/styles",
    "b:style:2": "postcss build/styles/*.css --use autoprefixer --d build/styles",
    "b:static": "cp -R static/. build/",
    "w:1": "watchify turnStyles.js -o build/turnStyles.js",
    "w:2": "node-sass turnStyles.sass -wo build",
    "w:3": "node-sass sass/themes -wo build/themes",
    "w:4": "node-sass sass/styles -wo build/styles"
  },
  "devDependencies": {
    "autoprefixer": "^10.2.5",
    "babel-eslint": "^10.1.0",
    "browserify": "^17.0.0",
    "concurrently": "^6.0.0",
    "eslint": "^7.22.0",
    "node-sass": "^5.0.0",
    "postcss": "^8.2.9",
    "postcss-cli": "^8.3.1",
    "sass": "^1.32.8",
    "tinyify": "^3.0.0",
    "watchify": "^4.0.0"
  },
  "dependencies": {}
}

},{}],24:[function(require,module,exports){
let turnStyles = window.$tS = {}
// a thing by pixelcrisis

require('./data/config.js')(turnStyles)

require('./core/global.js')(turnStyles)
require('./core/layout.js')(turnStyles)
require('./core/ttlink.js')(turnStyles)
require('./core/events.js')(turnStyles)
require('./core/logger.js')(turnStyles)
require('./core/timing.js')(turnStyles)
require('./core/notify.js')(turnStyles)

require('./data/session.js')(turnStyles)
require('./data/storage.js')(turnStyles)
require('./data/updates.js')(turnStyles)

require('./main/themes.js')(turnStyles)
require('./main/volume.js')(turnStyles)
require('./main/profile.js')(turnStyles)
require('./main/chatbox.js')(turnStyles)
require('./main/playlist.js')(turnStyles)

require('./core/panels.js')(turnStyles)
require('./core/attach.js')(turnStyles)

require('./main/afk.js')(turnStyles)
require('./main/auto.js')(turnStyles)
require('./main/stats.js')(turnStyles)
require('./main/alerts.js')(turnStyles)

// attach to the room
turnStyles.attach()
},{"./core/attach.js":1,"./core/events.js":2,"./core/global.js":3,"./core/layout.js":4,"./core/logger.js":5,"./core/notify.js":6,"./core/panels.js":7,"./core/timing.js":8,"./core/ttlink.js":9,"./data/config.js":10,"./data/session.js":11,"./data/storage.js":12,"./data/updates.js":13,"./main/afk.js":14,"./main/alerts.js":15,"./main/auto.js":16,"./main/chatbox.js":17,"./main/playlist.js":18,"./main/profile.js":19,"./main/stats.js":20,"./main/themes.js":21,"./main/volume.js":22}]},{},[24]);
