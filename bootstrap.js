const {classes: Cc, interfaces: Ci, manager: Cm, results: Cr, utils: Cu, Constructor: CC} = Components;

Cu.import('resource://gre/modules/ctypes.jsm');
Cu.import('resource://gre/modules/osfile.jsm'); // this gives the `OS` variable which is very useful for constants like `OS.System`, `OS.Constants.libc`, `OS.Constants.Win`. Constants missing from `.libc` and `.Win` you can define in the `CONSTS` object in the respective ostypes module
Cu.import('resource://gre/modules/Services.jsm');

var core = {
    addon: {
        name: 'ostypes_playground',
        id: 'ostypes_playground@jetpack',
        path: {
            content: 'chrome://ostypes_playground/content/',
            modules: 'chrome://ostypes_playground/content/modules/'
        }
    },
    os: {
        name: OS.Constants.Sys.Name.toLowerCase(), // possible values are here - https://developer.mozilla.org/en-US/docs/Mozilla/Developer_guide/Build_Instructions/OS_TARGET
        toolkit: Services.appinfo.widgetToolkit.toLowerCase(),
        xpcomabi: Services.appinfo.XPCOMABI
    },
    firefox: {
        pid: Services.appinfo.processID,
        version: Services.appinfo.version
    }
};
core.os.mname = core.os.toolkit.indexOf('gtk') == 0 ? 'gtk' : core.os.name; // mname stands for modified-name // this will treat solaris, linux, unix, *bsd systems as the same. as they are all gtk based

var BOOTSTRAP = this;

function initOstypes() {
	Services.scriptloader.loadSubScript(core.addon.path.modules + 'ostypes/cutils.jsm', BOOTSTRAP); // need to load cutils first as ostypes_mac uses it for HollowStructure
	Services.scriptloader.loadSubScript(core.addon.path.modules + 'ostypes/ctypes_math.jsm', BOOTSTRAP);
	switch (core.os.mname) {
		case 'winnt':
		case 'winmo':
		case 'wince':
			console.log('loading:', core.addon.path.modules + 'ostypes/ostypes_win.jsm');
			Services.scriptloader.loadSubScript(core.addon.path.modules + 'ostypes/ostypes_win.jsm', BOOTSTRAP);
			break
		case 'gtk':
			Services.scriptloader.loadSubScript(core.addon.path.modules + 'ostypes/ostypes_x11.jsm', BOOTSTRAP);
			break;
		case 'darwin':
			Services.scriptloader.loadSubScript(core.addon.path.modules + 'ostypes/ostypes_mac.jsm', BOOTSTRAP);
			break;
		default:
			throw new Error('Operating system, "' + OS.Constants.Sys.Name + '" is not supported');
	}
}

var OSStuff = {};
function main() {
	switch (core.os.mname) {
			case 'winnt':

					const MMSYSERR_NOERROR = 0;

					var nDevices = ostypes.API('waveInGetNumDevs')();
					console.log('nDevices:', nDevices, nDevices.toString(), uneval(nDevices));

					var formats = [];
					var stWIC = ostypes.TYPE.WAVEINCAPS();
					console.log('ostypes.TYPE.WAVEINCAPS.size:', ostypes.TYPE.WAVEINCAPS.size);
					for(var i=0; i<nDevices; i++) {
						var mRes = ostypes.API('waveInGetDevCaps')(i, stWIC.address(), ostypes.TYPE.WAVEINCAPS.size);
						console.log('mRes:', mRes, mRes.toString(), uneval(mRes));
						if (!cutils.jscEqual(mRes, MMSYSERR_NOERROR)) {
							console.error('failed to get waveInGetDevCaps, mRes:', mRes, mRes.toString());
							throw new Error('failed to get waveInGetDevCaps');
						}
						console.log('stWIC:', stWIC, stWIC.toString(), uneval(stWIC));
						formats.push(stWIC.szPname.readString());
					}
					console.log('formats:', formats);

					try {

					} catch(ex) {
						console.error('error occoured:', ex);
					} finally {

					}

				break;
			default:
				console.error('Your os is not yet supported, your OS is: ' + core.os.mname);
				throw new Error('Your os is not yet supported, your OS is: ' + core.os.mname);
	}
}

function unmain() {

}

function install() {}
function uninstall() {}

function startup(aData, aReason) {

	initOstypes();
	main();

}

function shutdown(aData, aReason) {
	if (aReason == APP_SHUTDOWN) { return }

	unmain();
}

// start - common helper functions
function xpcomSetTimeout(aNsiTimer, aDelayTimerMS, aTimerCallback) {
	aNsiTimer.initWithCallback({
		notify: function() {
			aTimerCallback();
		}
	}, aDelayTimerMS, Ci.nsITimer.TYPE_ONE_SHOT);
}
// end - common helper functions
