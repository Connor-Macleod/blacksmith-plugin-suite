//=============================================================================
// BlacksmithPluginManager.js - v0.1.0
//=============================================================================

/*:
 * @plugindesc Allows management of plugin dependencies
 * @author Connor "Saelorable" Macleod <Blacksmith[at]saelora.com>
 *
 * @help This plugin does not provide plugin commands.
 *
 * @param cacheOnlinePlugins
 * @desc Should online plugins be cached when ran locally?. "true/false"
 * @default true
 *
 * @param onlinePlugins
 * @desc comma separates list of plugin URLs
 * EXAMPLE: "http://example.com/plugin.js, https://example.com/plugin.LPMP
 * @default ""
 *
 * @param extraPluginParameters
 * @desc parameters for plugins can also be set in js/params/pluginName.json
 * @default examplePlugin.param = "example value"; examplePlugin.param2 = "another example value"
 *
 * @param allowRemoteConfigJson
 * @desc ADVANCED USERS: set to true to load config from  js/params/BlacksmithPluginManager.json !POTENTIAL LAG!
 * @default false
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

(function(){
    let pluginList = [];
    let Globals = {};
    let state = {};
    let initialised = [];
    let onlinePlugins = [];
    let parameters = PluginManager.parameters('BlacksmithPluginManager');


    let allowRemoteConfigJson = parameters.allowRemoteConfigJson.toLowerCase()==="true";

    let parameters2;
    let paramsPath = "js/params/BlacksmithPluginManager.json";
    if (Utils.isNwjs()){
        let fs = require("fs");
        if (fs.existsSync(paramsPath)){
            paramsFile = fs.readFileSync(paramsPath);
            parameters2 = JSON.parse(paramsFile)
        }
    } else if(allowRemoteConfigJson) {
        let request = new XMLHttpRequest();
        request.open('GET', paramsPath, false);  // `false` makes the request synchronous
        request.send(null);
        if (request.status === 200) {
            parameters2 = JSON.parse(request.responseText);
        }
    }
    if (!parameters){
        parameters = {};
    }
    if (parameters2){
        for (let param in parameters2){
            if (parameters2.hasOwnProperty(param)) {
                parameters[param] = parameters2[param];
            }
        }
    }

    const cacheOnlineDependencies = parameters.cacheOnlinePlugins.toLowerCase() === "true";

    parameters.pluginParameters = {};
    let extraPluginParameters = parameters.extraPluginParameters.split(";");
    extraPluginParameters.forEach(function(paramater){
        let paramName = paramater.split("=")[0];
        let paramValue = paramater.split("=")[1];
        let pluginName = paramName.split(".")[0];
        paramName = paramName.split(".")[0];
        if (!parameters.pluginParameters[pluginName]){
            parameters.pluginParameters[pluginName] = {};
        }
        parameters.pluginParameters[pluginName][paramName] = paramValue;
    });

    const initNext = function(){
        for (let plugin of pluginList){
            if (!plugin._initialised){
                if (!plugin.dependencies){
                    //we initlaise this function if it has no dependencies
                    plugin._initFunction();
                    initialised.push(plugin);
                    return true;
                } else {
                    let allInitialised = true;
                    for (let dependency of plugin.dependencies){
                        if (!dependency._initialised){
                            allInitialised = false
                        }
                    }
                    if (allInitialised){
                        // we initialise this function if all of it's dependencies have been met
                        return plugin._initFunction();
                    }
                }
            }
        }
        let loadFailed = pluginList.find(function(plugin){
            return !plugin._initialised;
        });
        if (loadFailed){
            return //an error;
        }
        allInitialised();
    };

    const initlaisePlugins = function(){
        initNext();
    };
    let dirtyHookSceneManagerRun = SceneManager.run;
    SceneManager.run = function(...args){
        //all plugins have loaded, but we still need to initialise ours!
        dirtyHookSceneManagerRun = dirtyHookSceneManagerRun.bind(SceneManager, ...args);
        initlaisePlugins();

    };

    const allInitialised = function(){
        dirtyHookSceneManagerRun();
    };

    const getPluginNameFromUrl = function(url){
        return /[^/]*$/.exec(url)[0].replace(/.js|.LPMP/, "");
    };

    const streamDependency = function(url){
        let script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;
        script.async = false;
        script.onerror = this.onError.bind(this);
        script._url = url;
        document.body.appendChild(script);
    };

    const cachePlugin = function(plugin){
        const http = require('http');
        const fs = require('fs');
        const file = fs.createWriteStream("js/plugins/cachedWebPlugins/"+plugin.name+".js");
        http.get(plugin.url, function(response) {
            response.pipe(file);
        });
        streamDependency(plugin.url);
    };

    const loadFromCache = function(pluginName){
        const path = "js/plugins/cachedWebPlugins/"+ pluginName + ".js";
        const fs = require('fs');
        if (!fs.existsSync(path)) {
            return false;
        }
        let script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = path;
        script.async = false;
        script.onerror = this.onError.bind(this);
        script._url = path;
        document.body.appendChild(script);
    };

    const loadOnlineDependency = function(dependency){
        if (cacheOnlineDependencies && Utils.isNwjs){
            if (loadFromCache(dependency.name)){
                return;
            } else {
                cachePlugin(dependency);
            }
        } else {
            streamDependency(dependency.url)
        }

    };

    const loadOnlinePlugins = function(){
        let onlinePlugins = parameters.onlinePlugins.split(",");
        onlinePlugins.forEach(function(plugin){
            plugin = plugin.trim();
            loadOnlineDependency({
                url: plugin,
                name: getPluginNameFromUrl(plugin)
            });
        });
    }
    loadOnlinePlugins();

    let fastParameters = {};

    const preloadParamaters = function(pluginName){
        let pluginParameters = PluginManager._parameters[pluginName.toLowerCase()];
        let pluginParameters2;
        let paramsPath = "js/params/"+pluginName+".json";
        let paramsLoadedCallback = function(){
            if (!pluginParameters) {
                pluginParameters = {};
            }
            if (pluginParameters2){
                for (let param in pluginParameters2){
                    if (pluginParameters2.hasOwnProperty(param)) {
                        pluginParameters[param] = pluginParameters2[param];
                    }
                }
            }
            if (parameters.pluginParameters[pluginName]){
                for (let param in parameters.pluginParameters[pluginName]){
                    if (parameters.pluginParameters[pluginName].hasOwnProperty(param)) {
                        pluginParameters[param] = parameters.pluginParameters[pluginName][param];
                    }
                }
            }
            fastParameters[pluginName] = pluginParameters;
        };

        if (Utils.isNwjs()){
            let fs = require("fs");
            if (fs.existsSync(paramsPath)){
                fs.readFile(paramsPath, function(err, data){
                    pluginParameters2 = JSON.parse(data);
                    paramsLoadedCallback();
                });
            }
        } else {
            let request = new XMLHttpRequest();
            request.open('GET', paramsPath);
            request.send(null);

            request.addEventListener("load", function(){
                if (request.status === 200) {
                    pluginParameters2 = JSON.parse(this.responseText);
                    paramsLoadedCallback();
                }
            });
        }

    };

    PluginManager.parameters = function(pluginName){
        if (fastParameters[pluginName]){
            return fastParameters[pluginName];
        }
        let pluginParameters = PluginManager._parameters[pluginName.toLowerCase()];
        let pluginParameters2;
        let paramsPath = "js/params/"+pluginName+".json";
        if (Utils.isNwjs()){
            let fs = require("fs");
            if (fs.existsSync(paramsPath)){
                paramsFile = fs.readFileSync(paramsPath);
                pluginParameters2 = JSON.parse(paramsFile)
            }
        } else {
            let request = new XMLHttpRequest();
            request.open('GET', paramsPath, false);  // `false` makes the request synchronous
            request.send(null);
            if (request.status === 200) {
                pluginParameters2 = JSON.parse(request.responseText);
            }
        }
        if (!pluginParameters) {
            pluginParameters = {};
        }
        if (pluginParameters2){
            for (let param in pluginParameters2){
                if (pluginParameters2.hasOwnProperty(param)) {
                    pluginParameters[param] = pluginParameters2[param];
                }
            }
        }
        fastParameters[pluginName] = pluginParameters;
        return pluginParameters;
    };

    class Plugin {
        constructor(pluginConfig){
            // id and dependencies are required, so we don't check for them
            // TODO: error handling for incorrectly created Plugins to make it more clear when an author has messed up
            if (!pluginConfig.globals){
                pluginConfig.globals = [];
            }
            if (!pluginConfig.humanReadableName){
                pluginConfig.humanReadableName = pluginConfig.id.replace(/([A-Z])/g, " $1").replace(/^ /, "");
            }
            if (!pluginConfig.dependencies){
                pluginConfig.dependencies = [];
            }
            this._id = pluginConfig.id;
            this._humanReadableName = pluginConfig.humanReadableName;
            this._globals = pluginConfig.globals;
            this._dependencies = pluginConfig.dependencies;
            this._initFunction = pluginConfig.initializer;
            Globals[this._id] = this._globals;
            if (this.dependencies){
                this.dependencies.forEach(function(dependency){
                    if (typeof dependency == "string"){
                        if (dependency.match(/^https?:\/\//)){
                            dependency = {
                                url: dependency
                            };
                        } else {
                            dependency = {
                                name: dependency
                            };
                        }
                    }
                    if (dependency.url){
                        if (!dependency.name){
                            dependency.name = getPluginNameFromUrl(dependency.url)
                        }
                        if (!onlinePlugins.contains(dependency.name)){
                            loadOnlineDependency(dependency);
                            onlinePlugins.push(dependency.name);
                        }
                    } else {
                        if (!PluginManager._scripts.contains(dependency.name)) { // we load dependencies even if they're turned off
                            PluginManager.loadScript(dependency.name + '.js');
                            PluginManager._scripts.push(dependency.name);
                        }
                    }
                });
            }
            preloadParamaters(this._id);
            pluginList[this._id] = this;
        }

        set init(initFunction){
            if (!this._initFunction){
                this._initFunction = initFunction(function(error, message){
                    if (error){
                        //terminate loading with helpful message
                    } else {
                        this._initialised=true;
                        initNext();
                    }
                });
            } else {
                //throw error about init function already registered
            }
        }

        get dependencies(){
            if (
                !this._dependencies ||
                this._dependencies instanceof Plugin ||
                this._dependencies.length===0
            ){
                return false;
            }
            if (this._dependencies instanceof Plugin){
                return [this._dependencies];
            }
            if (this._dependencies.length > 0){
                return this._dependencies
            }

        }

        global (name, value){
            if (value!==undefined){
                Globals[this._id][name] = value;
            }
            return Globals[this._id][name];
        }
    }


    PluginManager.Plugin = Plugin;
    PluginManager.plugins = pluginList

})();
