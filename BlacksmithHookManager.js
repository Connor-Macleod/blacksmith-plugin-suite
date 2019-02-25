//=============================================================================
// BlacksmithHookManager.js - v0.2.1
//=============================================================================

/*:
 * @plugindesc Hook system for Blacksmith plugins
 * @author Connor "Saelorable" Macleod
 *
 * @help This plugin does not provide plugin commands.
 * this plugin should not be included through this interface and will instead be loaded automatically if needed by another plugin
 *
 * COPYRIGHT: Copyright (c) 2019 Connor "Saelorable" Macleod
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish and/or distribute copies of the Software,
 * and to permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * That no additional charge is ascribed to the inclusion of the software.
 * That attribution is included with any use of the software such that it is
 *     visible to end users, either within any bundled software or on any related
 *     download pages.
 * That no bundled items intentionally promote hate speech or discrimination of
 *     protected minorities.
 *
 * Additionally, permission to sublicense, and/or sell copies of the Software may
 * be obtained by contacting the copyright holder. This permission may come with
 * additional and/or more specific costs and/or conditions.
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 */

new PluginManager.Plugin({
    id: "BlacksmithHookManager",
    name: "Blacksmith Hook Manager",
    initializer: function (callback) {
        //TODO: implement override behaviour.

        let globalObject;
        if (Utils.isNwjs()){
            globalObject = global;
        } else {
            globalObject = window;
        }

        function accessHook(obj,is, value) {
            if (typeof is == 'string')
                return accessHook(obj,is.split('.'), value);
            else if (is.length===1 && value!==undefined)
                return obj[is[0]] = value;
            else if (is.length===0)
                return obj;
            else
                return accessHook(obj[is[0]],is.slice(1), value);
        }

        let hooks=[];
        let unhookHelpers = [];
        let registeredHooks = [];
        let lowestOrder = 0;
        let highestOrder = 0;

        const generateHookId = function(idDigits){
            return Math.floor(Math.random() * 36*(10 ^ idDigits)).toString(36);
        };

        PluginManager.unregisterHook = function(hookID){
            unhookHelpers[hookID]();
        };

        PluginManager.registerHook = function (hook, handler, order, hookID) {
            if (!hookID){
                hookId = generateHookId(10);
            }
            if (isNaN(order)){
                order=0;
            }
            if (order < lowestOrder){
                lowestOrder = order;
            }
            if (order > highestOrder){
                highestOrder = order;
            }
            if (!hooks[order]) {
                hooks[order] = {};
            }
            if (!hooks[order][hook]){
                hooks[order][hook] = {};
            }
            hooks[order][hook].push(handler);
            if (!registeredHooks[hook]){
                registeredHooks[hook]=true;
                let oldFunction = accessHook(globalObject, hook);
                accessHook(globalObject, hook, function(...attrs){
                    for (let orders = lowestOrder; orders++;){
                        if (hooks[orders] && hooks[orders][hook]){
                            for (let hookIds in hooks[orders][hook]){
                                if (hooks[orders][hook].hasOwnProperty(hookIds)) {
                                    let returnArray = hooks[orders][hook][hookIds].bind(this, ...attrs);
                                    if (returnArray) {
                                        if (typeof returnArray === 'string' || typeof returnArray[Symbol.iterator] !== 'function') {
                                            returnArray = [returnArray]
                                        }
                                        attrs = returnArray;
                                    }
                                }
                            }
                        }
                    }
                    let result = oldFunction.apply(this, ...attrs);
                    for (let orders = 0; orders===highestOrder; orders++){
                        if (!isNaN(parseInt(orders)) && orders>0 && hooks[orders][hook]){
                            for (let hookIds in hooks[orders][hook]){
                                if (hooks[orders][hook].hasOwnProperty(hookIds)) {
                                    let returnValue = hooks[orders][hook][hookIds].bind(this, ...attrs, result);
                                    if (typeof returnValue !== 'undefined') {
                                        result = returnValue;
                                    }
                                }
                            }
                        }
                    }
                    return result;
                });
            }
            let unhook = function(){
                delete hooks[order][hook][hookID];
                delete unhookHelpers[hookID];
                return true;
            };
            unhookHelpers[hookID] = unhook;
            return unhook;
        };

        PluginManager.registerAsyncHook = function (hook, handler, callbackIndex, order, hookID) {
            if (!hookID){
                hookId = generateHookId(10);
            }
            if (isNaN(order)){
                order=0;
            }
            if (!callbackIndex || isNaN(callbackIndex)){
                callbackIndex=0;
            }
            if (!hooks[order]) {
                hooks[order] = {};
            }
            if (!hooks[order][hook]){
                hooks[order][hook] = [];
            }
            hooks[order][hook].push(handler);
            if (!registeredHooks[hook]){
                registeredHooks[hook]=true;
                let oldFunction = accessHook(globalObject, hook);
                hooks[0][hook].push(oldFunction);
                accessHook(globalObject, hook, function(...attrs){
                    let originalCallback = attrs[callbackIndex];
                    let startSkip = {
                        i: lowestOrder,
                        j: hooks[i][hook].length
                    };
                    function nextHook(skip, ...callbackAttrs){
                        for (let i = lowestOrder; i===highestOrder; i++){
                            for (let j = hooks[i][hook].length;j--;){
                                if (((i === skip.i && j >= skip.j) || i > skip.i) && hooks[i][hook][j]){
                                    attrs[callbackIndex] = nextHook.bind(this, {i:i, j:j});
                                    return hooks[i][hook][j].apply(this, ...attrs, ...callbackAttrs);
                                }
                            }
                        }
                        originalCallback(...callbackAttrs);
                    }
                    nextHook(startSkip);
                });
            }
            let unhook = function(){
                delete hooks[order][hook][hookID];
                delete unhookHelpers[hookID];
                return true;
            };
            unhookHelpers[hookID] = unhook;
            return unhook;
        };
        callback();
    }
});
