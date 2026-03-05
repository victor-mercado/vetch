// This file simulates the Scratch Addons extension API environment
// so that unmodified Turbowarp addons can run in pSVG.

window.scratchAddons = window.scratchAddons || {};

class EventTargetMock {
    constructor() {
        this.listeners = {};
    }

    addEventListener(type, callback) {
        if (!this.listeners[type]) this.listeners[type] = [];
        this.listeners[type].push(callback);
    }

    removeEventListener(type, callback) {
        if (!this.listeners[type]) return;
        this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
    }

    dispatchEvent(event) {
        if (this.listeners[event.type]) {
            this.listeners[event.type].forEach(cb => cb(event));
        }
    }
}

class ReduxMock extends EventTargetMock {
    constructor(store) {
        super();
        this.store = store;
        this.state = store.getState();

        // Listen to actual redux store and dispatch statechanged events
        store.subscribe(() => {
            const newState = store.getState();
            this.state = newState;
        });
    }

    initialize() {
        // Required by addons
    }

    dispatch(action) {
        return this.store.dispatch(action);
    }
}

let sharedReduxMock = null;
let dispatchPatched = false;

export const createAdapter = (store, addonId = "default") => {
    if (!sharedReduxMock) {
        sharedReduxMock = new ReduxMock(store);
    }

    if (!dispatchPatched) {
        const originalDispatch = store.dispatch;
        store.dispatch = function (action) {
            const result = originalDispatch.call(store, action);
            sharedReduxMock.state = store.getState();
            sharedReduxMock.dispatchEvent({
                type: 'statechanged',
                detail: { action, prev: {}, next: sharedReduxMock.state }
            });
            return result;
        };
        dispatchPatched = true;
    }

    return {
        addon: {
            self: new class extends EventTargetMock {
                constructor() {
                    super();
                    this.disabled = false;
                    this.enabledLate = true;
                    this.dir = '';
                }
            }(),
            tab: {
                editorMode: "editor",
                redux: sharedReduxMock,
                scratchClass: (...args) => {
                    return args.map(arg => {
                        const el = document.querySelector(`[class*="${arg}"]`);
                        if (el) {
                            return Array.from(el.classList).find(c => c.startsWith(arg)) || arg;
                        }
                        return arg;
                    }).join(" ");
                },
                traps: {
                    getPaper: async () => {
                        // Wait for paper and the select tool to be available on window
                        return new Promise(resolve => {
                            let loggedTools = false;
                            const check = () => {
                                if (window.paper && window.paper.project && window.paper.tools) {
                                    if (!loggedTools && window.paper.tools.length > 0) {
                                        console.log("pSVG tools:", window.paper.tools);
                                        loggedTools = true;
                                    }
                                    const hasSelectTool = window.paper.tools.some(t => t.boundingBoxTool);
                                    if (hasSelectTool) {
                                        sharedReduxMock.state = store.getState();
                                        resolve(window.paper);
                                        return;
                                    }
                                }
                                setTimeout(check, 50);
                            };
                            check();
                        });
                    }
                },
                displayNoneWhileDisabled: (el) => {
                    // Extension is always enabled in pSVG
                },
                waitForElement: async (selector, opts) => {
                    return new Promise(resolve => {
                        const check = () => {
                            const elements = document.querySelectorAll(selector);
                            for (const el of elements) {
                                if (opts?.markAsSeen) {
                                    if (!el.dataset[`saMarkedAsSeen_${addonId}`]) {
                                        el.dataset[`saMarkedAsSeen_${addonId}`] = "true";
                                        resolve(el);
                                        return;
                                    }
                                } else {
                                    resolve(el);
                                    return;
                                }
                            }
                            setTimeout(check, 100);
                        };
                        check();
                    });
                },
                appendToSharedSpace: ({ space, element, order }) => {
                    if (space === "paintEditorZoomControls") {
                        const zoomControls = document.querySelector("[class*='paint-editor_zoom-controls_']");
                        if (zoomControls) {
                            zoomControls.appendChild(element);
                        }
                    }
                }
            },
            settings: new class extends EventTargetMock {
                get(key) {
                    // Default settings for paint-snap 
                    if (key === 'enable-default') return true;
                    if (key === 'guide-color') return '#c40f0fff';
                    if (key === 'threshold') return 5;

                    const defaultSnaps = ['pageEdges', 'pageCenter', 'pageAxes', 'objectEdges', 'objectCenters', 'objectMidlines', 'boxCenter'];
                    if (defaultSnaps.includes(key)) return true;
                    if (['pageCorners', 'objectCorners', 'boxCorners', 'boxEdgeMids'].includes(key)) return false;

                    return null;
                }
            }()
        },
        console: window.console,
        msg: (key) => key // Mock translation function
    };
};
