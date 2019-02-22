//=============================================================================
// BlacksmithHookManager.js - v0.1.0
//=============================================================================

/*:
 * @plugindesc Hook system for Blacksmith plugins
 * @author Connor "Saelorable" Macleod
 *
 * @help This plugin does not provide plugin commands.
 * this plugin should not be included through this interface and will instead be loaded automatically if needed by another plugin
 *
 * @copyright  Copyright (c) 2019 Connor "Saelorable" Macleod
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
            globalObject = Window;
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

        let hooks=[{},{}];

        PluginManager.registerHook = function (hook, handler, order) {
            if (!order){
                order=0;
            }
            let attachHook = false;
            if (!hooks[order][hook]){
                attachHook = true;
                hooks[order][hook] = [];
            }
            hooks[order][hook].push(handler);

            if (attachHook){
                let oldFunction = accessHook(globalObject, hook);
                accessHook(globalObject, hook, function(...attrs){
                    if (hooks[0][hook]){
                        hooks[0][hook].forEach(function(HookHandler){
                            HookHandler.apply(this, ...attrs)
                        });
                    }
                    let result = oldFunction.apply(this, ...attrs);
                    if (hooks[1][hook]){
                        hooks[1][hook].forEach(function(HookHandler){
                            let hookResult = HookHandler.bind(this, ...attrs)(result)
                            if (typeof hookResult !== "undefined"){
                                result = hookResult;
                            }

                        });
                    }
                    return result;
                });
            }
        }
        callback();
    }
});
