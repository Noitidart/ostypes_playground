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

function loopbackCapture() {
    switch (core.os.mname) {
        case 'winnt':

                // constants
                var BREAK = {};

                try {

                    // get default device
                    var CLSID_MMDeviceEnumerator = ostypes.HELPER.CLSIDFromArr([0xBCDE0395, 0xE52F, 0x467C, [0x8E, 0x3D, 0xC4, 0x57, 0x92, 0x91, 0x69, 0x2E]]);
                    var IID_IMMDeviceEnumerator = ostypes.HELPER.CLSIDFromArr([0xA95664D2, 0x9614, 0x4F35, [0xA7, 0x46, 0xDE, 0x8D, 0xB6, 0x36, 0x17, 0xE6]]);
                    var {iface:devEnum, inst:devEnumPtr} = createInst('IMMDeviceEnumerator', CLSID_MMDeviceEnumerator, IID_IMMDeviceEnumerator);
                    if (!devEnum) {
                        throw BREAK;
                    }

                    var mmDevPtr = ostypes.TYPE.IMMDevice.ptr();
                    var hr_getEndpt = devEnum.GetDefaultAudioEndpoint(devEnumPtr, ostypes.CONST.eRender, ostypes.CONST.eConsole, mmDevPtr.address());
                    if (ostypes.HELPER.checkHR(hr_getEndpt, 'hr_getEndpt') !== 1) {
                        throw BREAK;
                    }
                    var mmDev = mmDevPtr.contents.lpVtbl.contents;

                    ostypes.HELPER.SafeRelease(devEnumPtr, 'devEnum');

                    // activate an (the default, for us, since we want loopback) IAudioClient
                    var IID_IAudioClient = ostypes.HELPER.CLSIDFromArr([0x1CB9AD4C, 0xDBFA, 0x4c32, [0xB1, 0x78, 0xC2, 0xF5, 0x68, 0xA7, 0x03, 0xB2]]);
                    // var IID_IAudioRenderClient = ostypes.HELPER.CLSIDFromArr([0xF294ACFC, 0x3146, 0x4483, [0xA7, 0xBF, 0xAD, 0xDC, 0xA7, 0xC2, 0x60, 0xE2]]);
                    var audClientPtr = ostypes.TYPE.IAudioClient.ptr();
                    var hr_activate = mmDev.Activate(mmDevPtr, IID_IAudioClient.address(), ostypes.CONST.CLSCTX_INPROC_SERVER, null, audClientPtr.address());
                    if (ostypes.HELPER.checkHR(hr_activate, 'hr_activate') !== 1) {
                        throw BREAK();
                    }
                    var audClient = audClientPtr.contents.lpVtbl.contents;

                    // get the default device periodicity, why? I don't know...
                    var hnsDefaultDevicePeriod = ostypes.TYPE.REFERENCE_TIME();
                    var hr_getPeriod = audClient.GetDevicePeriod(audClientPtr, hnsDefaultDevicePeriod.address(), null);
                    if (ostypes.HELPER.checkHR(hr_getPeriod, 'hr_getPeriod') !== 1) {
                        throw BREAK();
                    }

                    // get the default device format (incoming...)
                    var pwfx = ostypes.TYPE.WAVEFORMATEX.ptr();
                    var hr_getFormat = audClient.GetMixFormat(audClientPtr, pwfx.address());
                    if (ostypes.HELPER.checkHR(hr_getFormat, 'hr_getFormat') !== 1) {
                        // he does CoTaskMemFree on pwfx here as well which is weird i would think
                        throw BREAK;
                    }

                    // coerce int-XX wave format (like int-16 or int-32)
                    // can do this in-place since we're not changing the size of the format
                    // also, the engine will auto-convert from float to int for us
                    console.log('pwfx.wFormatTag:', pwfx.wFormatTag);
                    switch (parseInt(cutils.jscGetDeepest(pwfx.wFormatTag))) {
                    	case WAVE_FORMAT_IEEE_FLOAT:
                        		// we never get here...I never have anyway...my guess is windows vista+ by default just uses WAVE_FORMAT_EXTENSIBLE
                        		pwfx.wFormatTag = ostypes.CONST.WAVE_FORMAT_PCM;
                        		pwfx.wBitsPerSample = 16;
                        		pwfx.nBlockAlign = parseInt(cutils.jscGetDeepest(pwfx.nChannels)) * pwfx.wBitsPerSample / 8;
                        		pwfx.nAvgBytesPerSec = parseInt(cutils.jscGetDeepest(pwfx.nBlockAlign)) * parseInt(cutils.jscGetDeepest(pwfx.nSamplesPerSec));
                    		break;
                    	case WAVE_FORMAT_EXTENSIBLE: // 65534
                    			// naked scope for case-local variable
                    			var pEx = ctypes.cast(pwfx, ostypes.TYPE.PWAVEFORMATEXTENSIBLE);
                                console.log('pEx.SubFormat:', pEx.SubFormat);
                    			if (IsEqualGUID(KSDATAFORMAT_SUBTYPE_IEEE_FLOAT, pEx.SubFormat)) {
                    				// WE GET HERE!
                    				pEx.SubFormat = KSDATAFORMAT_SUBTYPE_PCM;
                    				// convert it to PCM, but let it keep as many bits of precision as it has initially...though it always seems to be 32
                    				// comment this out and set wBitsPerSample to  pwfex->wBitsPerSample = getBitsPerSample(); to get an arguably "better" quality 32 bit pcm
                    				// unfortunately flash media live encoder basically rejects 32 bit pcm, and it's not a huge gain sound quality-wise, so disabled for now.
                    				pwfx.wBitsPerSample = 16;
                    				pEx.Samples.wValidBitsPerSample = parseInt(cutils.jscGetDeepest(pwfx.wBitsPerSample));
                    				pwfx.nBlockAlign = parseInt(cutils.jscGetDeepest(pwfx.nChannels)) * parseInt(cutils.jscGetDeepest(pwfx.wBitsPerSample)) / 8;
                    				pwfx.nAvgBytesPerSec = parseInt(cutils.jscGetDeepest(pwfx.nBlockAlign)) * parseInt(cutils.jscGetDeepest(pwfx.nSamplesPerSec));
                    				// see also setupPwfex method
                    			} else {
                    				console.error("Don't know how to coerce mix format to int-16\n");
                    				throw BREAK;
                    			}
                    		break;
                    	default:
                    		console.error("Don't know how to coerce WAVEFORMATEX with wFormatTag:", pwfx.wFormatTag);
                    		throw BREAK;
                    }

                    var nBlockAlign = pwfx.nBlockAlign;

                    // avoid stuttering on close when using loopback
                    // http://social.msdn.microsoft.com/forums/en-US/windowspro-audiodevelopment/thread/c7ba0a04-46ce-43ff-ad15-ce8932c00171/

                    var REFTIMES_PER_SEC = 10000000;
                    var hnsRequestedDuration = REFTIMES_PER_SEC;

                } catch (ex if ex != BREAK) {
                    console.error('ERROR :: ', ex);
                } finally {
                    try { if (pwfx && !pwfx.isNull()) { ostypes.API('CoTaskMemFree')(pwfx); } } catch(ignore) { console.warn('error releasing pwfx', ignore); }
                    try { ostypes.HELPER.SafeRelease(devEnumPtr, 'devEnum'); } catch(ignore) { console.warn('error releasing devEnumPtr', ignore); }
                    try { ostypes.HELPER.SafeRelease(mmDevPtr, 'mmDev'); } catch(ignore) { console.warn('error releasing mmDevPtr', ignore); }
                    try { ostypes.HELPER.SafeRelease(audClientPtr, 'audClient'); } catch(ignore) { console.warn('error releasing audClientPtr', ignore); }
                }



            break;
        default:
            console.error('Your os is not yet supported, your OS is: ' + core.os.mname);
            throw new Error('Your os is not yet supported, your OS is: ' + core.os.mname);
    }
}

function createInst(type, clsid_desc, iid_desc) {
    // _desc is either string or arr
    // context is always CLSCTX_INPROC_SERVER
    var inst = ostypes.TYPE[type].ptr();
    var iface;

    var clsid = GUID_fromDesc(clsid_desc);
    var iid = GUID_fromDesc(iid_desc);

    var hr_create = ostypes.API('CoCreateInstance')(clsid.address(), null, ostypes.CONST.CLSCTX_INPROC_SERVER, iid.address(), inst.address());
    if (ostypes.HELPER.checkHR(hr_create, 'creation - ' + type)) {
        iface = inst.contents.lpVtbl.contents;
        return { inst, iface };
    } else {
        return {};
    }
}

function connectInputToOutput() {
	switch (core.os.mname) {
		case 'winnt':
                var VARIANT_BSTR = ctypes.StructType('tagVARIANT', [
                    { vt: ostypes.TYPE.VARTYPE },
                    { wReserved1: ostypes.TYPE.WORD },
                    { wReserved2: ostypes.TYPE.WORD },
                    { wReserved3: ostypes.TYPE.WORD },
                    { bstrVal: ostypes.TYPE.BSTR }
                ]);

                function GUID_fromDesc(aGuidDesc) {
                    return typeof(aGuidDesc) == 'string' ? ostypes.HELPER.CLSIDFromString(aGuidDesc) : ostypes.HELPER.CLSIDFromArr(aGuidDesc);
                }

                function findFirstPinOfDir(aPinsInst, aDir) {
                    // aPinsInst is ptr to ostypes.TYPE.IEnumPins
                    // if found, it will NOT release it, you need to release it, it returns an object with iface and inst
                    // else it returns empty object

                    // list the pins, as this is input, we want one with direction of in
                    var aPinsIface = aPinsInst.contents.lpVtbl.contents;

                    var pins = [];
                    while(true) {
                        var pin_info = {};

                        var pinPtr = ostypes.TYPE.IPin.ptr();
                        var pin = null;
                        var hr_nextPin = aPinsIface.Next(aPinsInst, 1, pinPtr.address(), null);
                        if (ostypes.HELPER.checkHR(hr_nextPin, 'hr_nextPin') !== 1) {
                            console.log('no more pins, breaking');
                            break;
                        }
                        pin = pinPtr.contents.lpVtbl.contents;

                        // var pinId = ostypes.TYPE.LPWSTR(); // .targetType.array(ostypes.CONST.MAX_PIN_NAME)();
                        // var hr_pinId = pin.QueryId(pinPtr, pinId.address());
                        // if (ostypes.HELPER.checkHR(hr_pinId, 'hr_pinId') !== 1) {
                        //     console.warn('no id for this pin, i dont know if this is possible');
                        // } else {
                        //     var pinIdCasted = ctypes.cast(pinId, ostypes.TYPE.WCHAR.array(ostypes.CONST.MAX_PIN_NAME).ptr).contents;
                        //     var pinIdJs = pinIdCasted.readString();
                        //     pin_info.id = pinIdJs;
                        //     // console.log('pinIdJs:', pinIdJs);
                        //     ostypes.API('CoTaskMemFree')(pinId);
                        // }

                        var pinDir = ostypes.TYPE.PIN_DIRECTION();
                        var hr_pinDir = pin.QueryDirection(pinPtr, pinDir.address());
                        if (ostypes.HELPER.checkHR(hr_pinDir, 'hr_pinDir') !== 1) {
                            console.warn('no dir for this pin, i dont know if this is possible');
                        } else {
                            var pinDirJs = parseInt(cutils.jscGetDeepest(pinDir));
                            pin_info.dir = pinDirJs;
                            // console.log('pinDirJs:', pinDirJs);
                        }

                        pins.push(pin_info);

                        if (pin_info.dir == aDir) {
                            return {
                                iface: pin,
                                inst: pinPtr
                            };
                        }
                        ostypes.HELPER.SafeRelease(pinPtr, 'pin');
                    }

                    console.log('pins:', pins);
                    console.error('ERROR - pin with direction', aDir, 'not found!');
                    return {};
                }

                // constants
                var guid_desc = { // descriptions of guids, as either string or array that goes into ostypes.HELPER.CLISDFromArr or CLSIDFromString
                    CLSID_SystemDeviceEnum: [0x62be5d10, 0x60eb, 0x11d0, [0xbd, 0x3b, 0x00, 0xa0, 0xc9, 0x11, 0xce, 0x86]],
                    IID_ICreateDevEnum: '29840822-5B84-11D0-BD3B-00A0C911CE86',
                    CLSID_FilterGraph: [0xe436ebb3, 0x524f, 0x11ce, [0x9f, 0x53, 0x00, 0x20, 0xaf, 0x0b, 0xa7, 0x70]],
                    IID_IGraphBuilder: [0x56a868a9, 0x0ad4, 0x11ce, [0xb0, 0x3a, 0x00, 0x20, 0xaf, 0x0b, 0xa7, 0x70]],
                    CLSID_SystemDeviceEnum: [0x62BE5D10, 0x60EB, 0x11d0, [0xBD, 0x3B, 0x00, 0xA0, 0xC9, 0x11, 0xCE, 0x86]],
                    IID_ICreateDevEnum: [0x29840822, 0x5b84, 0x11d0, [0xbd, 0x3b, 0x00, 0xa0, 0xc9, 0x11, 0xce, 0x86]],
                    CLSID_AudioInputDeviceCategory: [0x33d9a762, 0x90c8, 0x11d0, [0xbd, 0x43, 0x00, 0xa0, 0xc9, 0x11, 0xce, 0x86]],
                    CLSID_AudioRendererCategory: [0xe0f158e1, 0xcb04, 0x11d0, [0xbd, 0x4e, 0x00, 0xa0, 0xc9, 0x11, 0xce, 0x86]],
                    IID_IPropertyBag: '55272A00-42CB-11CE-8135-00AA004BB851',
                    IID_IBaseFilter: [0x56a86895, 0x0ad4, 0x11ce, [0xb0, 0x3a, 0x00, 0x20, 0xaf, 0x0b, 0xa7, 0x70]]
                };
                var IID_IMediaControl = ostypes.HELPER.CLSIDFromArr([0x56a868b1, 0x0ad4, 0x11ce, [0xb0, 0x3a, 0x00, 0x20, 0xaf, 0x0b, 0xa7, 0x70]]);
                const BREAK = {};

                try {
                    var {iface:graph, inst:graphPtr} = createInst('IGraphBuilder', guid_desc.CLSID_FilterGraph, guid_desc.IID_IGraphBuilder);
                    var {iface:deviceEnum, inst:deviceEnumPtr} = createInst('ICreateDevEnum', guid_desc.CLSID_SystemDeviceEnum, guid_desc.IID_ICreateDevEnum);

                    if (graph && deviceEnum) { // no need for !.isNull() test as if hr was FAILED then createInst would set these to undefined
                        var controlPtr = ostypes.TYPE.IMediaControl.ptr();
                        var hr_qi = graph.QueryInterface(graphPtr, IID_IMediaControl.address(), controlPtr.address());
                        if (ostypes.HELPER.checkHR(hr_qi, 'hr_qi') === 1) { // no need -  && !controlPtr.isNull() as hr was SUCCEEDED
                            var control = controlPtr.contents.lpVtbl.contents;

                            // get list input/output devices
                            var devices = []; // entries are objects {FriendlyName:string, CLSID:string, put:string, devMonk:cdata, devMonikPtr:cdata} // put is INPUT or OUTPUT

                            var categories = [GUID_fromDesc(guid_desc.CLSID_AudioInputDeviceCategory), GUID_fromDesc(guid_desc.CLSID_AudioRendererCategory)];
                            var varName;
                            var IID_IPropertyBag = GUID_fromDesc(guid_desc.IID_IPropertyBag);
                            for (var i=0; i<categories.length; i++) {
                                var category = categories[i];
                                var put = i === 0 ? 'INPUT' : 'OUTPUT';
                                var catEnumPtr = ostypes.TYPE.IEnumMoniker.ptr();
                				var hr_enum = deviceEnum.CreateClassEnumerator(deviceEnumPtr, category.address(), catEnumPtr.address(), 0);
            					if (ostypes.HELPER.checkHR(hr_enum, 'hr_enum') === 1) {
            						var catEnum = catEnumPtr.contents.lpVtbl.contents;

                                    while (true) {
                                        var device_info = {};

            							// pickup as moniker
            							var devMonikPtr = ostypes.TYPE.IMoniker.ptr();
            							var devMonik = null;
            							var hr_nextDev = catEnum.Next(catEnumPtr, 1, devMonikPtr.address(), null);
            							if (ostypes.HELPER.checkHR(hr_nextDev, 'hr_nextDev') !== 1) {
            								// when fetched is 0, we get hr_nextDev of `1` which is "did not succeed but did not fail", so checkHR returns -1
                                            console.log('no more devices in this category, breaking');
            								break;
            							}
            							devMonik = devMonikPtr.contents.lpVtbl.contents;

            							// bind the properties of the moniker
                                        var propBagPtr = ostypes.TYPE.IPropertyBag.ptr();
            							var hr_bind = devMonik.BindToStorage(devMonikPtr, null, null, IID_IPropertyBag.address(), propBagPtr.address());
            							if (ostypes.HELPER.checkHR(hr_bind, 'hr_bind')) {
            								var propBag = propBagPtr.contents.lpVtbl.contents;

                                            if (!varName) {
                                                // Initialise the variant data type
                                                varName = ostypes.TYPE.VARIANT();
                                                ostypes.API('VariantInit')(varName.address());
                                            }

                                            // get FriendlyName
            								var hr_read = propBag.Read(propBagPtr, 'FriendlyName', varName.address(), null);
            								if (ostypes.HELPER.checkHR(hr_read, 'hr_read')) {
                                                varNameCast = ctypes.cast(varName.address(), VARIANT_BSTR.ptr).contents;
            									// console.log('FriendlyName:', 'varNameCast.bstrVal:', varNameCast.bstrVal.readString());
                                                device_info.FriendlyName = varNameCast.bstrVal.readString();
            									ostypes.API('VariantClear')(varName.address());
            								}

                                            // get CLSID
            								var hr_read = propBag.Read(propBagPtr, 'CLSID', varName.address(), null);
            								if (ostypes.HELPER.checkHR(hr_read, 'hr_read')) {
                                                varNameCast = ctypes.cast(varName.address(), VARIANT_BSTR.ptr).contents;
            									// console.log('CLSID:', 'varNameCast.bstrVal:', varNameCast.bstrVal.readString());
                                                device_info.CLSID = varNameCast.bstrVal.readString(); // is "{E30629D2-27E5-11CE-875D-00608CB78066}" without the quotes
            									ostypes.API('VariantClear')(varName.address());
            								}

            								ostypes.HELPER.SafeRelease(propBagPtr, 'propBag');
            							}

                                        Object.assign(device_info, { devMonik, devMonikPtr, put });
                                        // ostypes.HELPER.SafeRelease(devMonikPtr, 'devMonik'); // dont release yet, this will be done after user has picked link33

                                        devices.push(device_info);
            						}

            						ostypes.HELPER.SafeRelease(catEnumPtr, 'catEnum');
            					}
                            }

                            ostypes.HELPER.SafeRelease(deviceEnumPtr, 'deviceEnum');

                            // used in both the prompt sections
                            var IID_IBaseFilter = GUID_fromDesc(guid_desc.IID_IBaseFilter);

                            // prompt user to pick input device or quit
                            var items = devices.filter(function(device) { return device.put == 'INPUT' });
                            items = items.map(function(item) { return '"' + item.FriendlyName + '" ------- ' + item.CLSID });
                            var selected = {};
                            var result = Services.prompt.select(Services.wm.getMostRecentWindow('navigator:browser'), 'Select Device', 'Choose input device:', items.length, items, selected);

                            if (!result || selected.value == -1) {
                                // user cancelled, or there were no items to pick from
                                throw BREAK;
                            }

                            var clsid = items[selected.value].split(' ------- ')[1];
                            for (var device of devices) {
                                if (device.CLSID == clsid) {
                                    break;
                                }
                            }

                            // user picked something. set it as pInputDevice which is IBaseFilter
                            device.selected = true;
                            var inputDevPtr = ostypes.TYPE.IBaseFilter.ptr();
                            var hr_initDevice = device.devMonik.BindToObject(device.devMonikPtr, null, null, IID_IBaseFilter.address(), inputDevPtr.address()); // Instantiate the device
                            if (ostypes.HELPER.checkHR(hr_initDevice, 'hr_initDevice input') !== 1) {
                                throw BREAK;
                            }
                            var inputDev = inputDevPtr.contents.lpVtbl.contents;

                            // also add it to the graph
                            var hr_add = graph.AddFilter(graphPtr, inputDevPtr, device.FriendlyName);
                            if (ostypes.HELPER.checkHR(hr_add, 'hr_add input') !== 1) {
                                throw BREAK;
                            }
                            // TODO: GC question, i dont use inputDevPtr/inputDev anymore (i dont think, another todo here, verify this), can I release it and GC it?

                            // prompt user to pick output device or quit
                            var items = devices.filter(function(device) { return device.put == 'OUTPUT' });
                            items = items.map(function(item) { return '"' + item.FriendlyName + '" ------- ' + item.CLSID });
                            var selected = {};
                            var result = Services.prompt.select(Services.wm.getMostRecentWindow('navigator:browser'), 'Select Device', 'Choose input device:', items.length, items, selected);

                            if (!result || selected.value == -1) {
                                // user cancelled, or there were no items to pick from
                                throw BREAK;
                            }

                            var clsid = items[selected.value].split(' ------- ')[1];
                            for (var device of devices) {
                                if (device.CLSID == clsid) {
                                    break;
                                }
                            }

                            // user picked something. set it as pOutputDevice which is IBaseFilter
                            device.selected = true;
                            var outputDevPtr = ostypes.TYPE.IBaseFilter.ptr();
                            var hr_initDevice = device.devMonik.BindToObject(device.devMonikPtr, null, null, IID_IBaseFilter.address(), outputDevPtr.address()); // Instantiate the device
                            if (ostypes.HELPER.checkHR(hr_initDevice, 'hr_initDevice output') !== 1) {
                                throw BREAK;
                            }
                            var outputDev = outputDevPtr.contents.lpVtbl.contents;

                            // also add it to the graph
                            var hr_add = graph.AddFilter(graphPtr, outputDevPtr, device.FriendlyName);
                            if (ostypes.HELPER.checkHR(hr_add, 'hr_add output') !== 1) {
                                throw BREAK;
                            }
                            // TODO: GC question, i dont use outputDevPtr/outputDev anymore (i dont think, another todo here, verify this), can I release it and GC it?

                            // release the entries from devices that were not selected, so delete devMonik and devMonikPtr from the entry afterwards, leave the name and clsid though for display puproses // link33
                            // TODO: figure out if i can release the devMonik/devMonikPtr of the seelcted devices. I dont use the monik anymore, i use the IBaseFilter inputDev/inputDevPtr and outputDev/outputDevPtr - my concern is these inputDev/outputDev is based on the devMonik of it, GC question, will figure out as i use it and research online, can force test it by releasing it and see if crash happens
                            for (var i=0; i<devices.length; i++) {
                                var { selected, devMonikPtr } = devices[i];
                                if (!selected) {
                                    ostypes.HELPER.SafeRelease(devMonikPtr);
                                }
                            }

                            // get input pins for connection
                            var inputPinsPtr = ostypes.TYPE.IEnumPins.ptr();
                            var hr_enumPins = inputDev.EnumPins(inputDevPtr, inputPinsPtr.address()); // Enumerate the pin
                            if (ostypes.HELPER.checkHR(hr_enumPins, 'hr_enumPins input') !== 1) {
                                throw BREAK;
                            }
                            var inputPins = inputPinsPtr.contents.lpVtbl.contents;

                            var { inst:inPinPtr, iface:inPin } = findFirstPinOfDir(inputPinsPtr, ostypes.CONST.PINDIR_OUTPUT);
                            if (!inPinPtr) {
                                throw BREAK;
                            }

                            // var inPinPtr = ostypes.TYPE.IPin.ptr()
                            // var hr_findPin = inputDev.FindPin(inputDevPtr, 'Capture', inPinPtr.address()); // Enumerate the pin
                            // if (ostypes.HELPER.checkHR(hr_findPin, 'hr_findPin input') !== 1) {
                            //     throw BREAK;
                            // }

                            // get output pins for connection
                            var outputPinsPtr = ostypes.TYPE.IEnumPins.ptr();
                            var hr_enumPins = outputDev.EnumPins(outputDevPtr, outputPinsPtr.address()); // Enumerate the pin
                            if (ostypes.HELPER.checkHR(hr_enumPins, 'hr_enumPins output') !== 1) {
                                throw BREAK;
                            }
                            var outputPins = outputPinsPtr.contents.lpVtbl.contents;

                            var { inst:outPinPtr, iface:outPin } = findFirstPinOfDir(outputPinsPtr, ostypes.CONST.PINDIR_INPUT);
                            if (!outPinPtr) {
                                throw BREAK;
                            }

                            // var outPinPtr = ostypes.TYPE.IPin.ptr()
                            // var hr_findPin = outputDev.FindPin(outputDevPtr, 'Capture', outPinPtr.address()); // Enumerate the pin
                            // if (ostypes.HELPER.checkHR(hr_findPin, 'hr_findPin output') !== 1) {
                            //     throw BREAK;
                            // }

                            // Connect the input pin to output pin
                            var hr_connect = inPin.Connect(inPinPtr, outPinPtr, null);
                            if (ostypes.HELPER.checkHR(hr_connect, 'hr_connect') !== 1) {
                                throw BREAK;
                            }

                            // now run the graph
                            var hr_run = control.Run(controlPtr);
                            if (ostypes.HELPER.checkHR(hr_run, 'hr_run') === 0) {
                                throw BREAK;
                            }
                        }
                    }
                } catch (ex if ex != BREAK) {
                    console.error('ERROR :: ', ex);
                } finally {
                    // if graph is running, then will not do clean up till after 10 seconds, otherwise it will clean up in 10ms
                    var isRunning = [1, -1].includes(ostypes.HELPER.checkHR(hr_run)); // checkHR accepts undefined, it will just return undefined
                    xpcomSetTimeout(undefined, isRunning ? 10000 : 10, function() {
                        if (isRunning) {
                            // means graph is running, so stop it
                            var hr_stop = control.Stop(controlPtr);
                            ostypes.HELPER.checkHR(hr_stop, 'hr_stop');
                        }
                        // if connected should we disconnect?
                        if (ostypes.HELPER.checkHR(hr_connect) === 1) {
                            // TODO: its connected, should i disconnect? for now i do disconnect them
                            // TODO: figure out how to use graph.Disconnect
                            // msdn docs say dont do it this way --> // var hr_disconnect = pIn.Disconnect(pInPtr, pOut, null); // The Filter Graph Manager calls this method when it disconnects two filters. Applications and filters should not call this method. Instead, call the IFilterGraph::Disconnect method on the Filter Graph Manager.
                            var hr_disconnect = graph.Disconnect(graphPtr, inPinPtr);
                            ostypes.HELPER.checkHR(hr_disconnect, 'hr_disconnect input');
                            var hr_disconnect = graph.Disconnect(graphPtr, outPinPtr);
                            ostypes.HELPER.checkHR(hr_disconnect, 'hr_disconnect output');
                        }
                        if (devices) {
                            for (var i=0; i<devices.length; i++) {
                                var { devMonkPtr } = devices[i];
                                ostypes.HELPER.SafeRelease(devMonikPtr); // if devMonikPtr is undefined, this will do nothing
                            }
                        }
                        ostypes.HELPER.SafeRelease(inputDevPtr, 'inputDev');
                        ostypes.HELPER.SafeRelease(outputDevPtr, 'outputDev');
                        ostypes.HELPER.SafeRelease(controlPtr, 'control');
                        ostypes.HELPER.SafeRelease(graphPtr, 'graph');
                        try { ostypes.HELPER.SafeRelease(deviceEnumPtr, 'deviceEnum'); } catch(ignore) { console.warn('error releasing deviceEnumPtr:', ignore); }
                        try { ostypes.HELPER.SafeRelease(filePtr, 'file'); } catch(ignore) { console.warn('error releasing filePtr:', ignore); }
                        try { ostypes.HELPER.SafeRelease(catEnumPtr, 'catEnum'); } catch(ignore) { console.warn('error releasing catEnumPtr:', ignore); }

                        // not sure when to release these, it seems this guy never did:
                        try { ostypes.HELPER.SafeRelease(inputPinsPtr, 'inputPins'); } catch(ignore) { console.warn('error releasing inputPinsPtr:', ignore); }
                        try { ostypes.HELPER.SafeRelease(inPinPtr, 'inPin'); } catch(ignore) { console.warn('error releasing inPinPtr:', ignore); }
                        try { ostypes.HELPER.SafeRelease(outputPinsPtr, 'outputPins'); } catch(ignore) { console.warn('error releasing outputPinsPtr:', ignore); }
                        try { ostypes.HELPER.SafeRelease(outPinPtr, 'outPin'); } catch(ignore) { console.warn('error releasing outPinPtr:', ignore); }
                    });
                }
            break;
        default:
            console.error('Your os is not yet supported, your OS is: ' + core.os.mname);
            throw new Error('Your os is not yet supported, your OS is: ' + core.os.mname);
        }
}

function main() {
    connectInputToOutput();
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
var gTempTimers = {}; // hold temporary timers, when first arg is not set for xpcomSetTimeout
function xpcomSetTimeout(aNsiTimer, aDelayTimerMS, aTimerCallback) {
    var timer;
    if (!aNsiTimer) {
        var timerid = Date.now();
        gTempTimers[timerid] = Cc['@mozilla.org/timer;1'].createInstance(Ci.nsITimer);
        timer = gTempTimers[timerid];
    } else {
        timer = aNsiTimer;
    }

	timer.initWithCallback({
		notify: function() {
			aTimerCallback();
            if (!aNsiTimer) {
                delete gTempTimers[timerid];
            }
		}
	}, aDelayTimerMS, Ci.nsITimer.TYPE_ONE_SHOT);
}
// end - common helper functions
