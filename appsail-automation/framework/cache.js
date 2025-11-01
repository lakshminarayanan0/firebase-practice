const Catalyst = require('zcatalyst-sdk-node');

class Cache
{
	constructor(req, segmentConfig, orgId, isMock)
	{
		this.mock = isMock;
		const cache = Catalyst.initialize(req).cache();
        this.segment = cache.segment(segmentConfig.id);
        if(segmentConfig.ttl_in_millis != null)
        {
            this.ttlInMillis = segmentConfig.ttl_in_millis;
        }
        else
        {
            this.ttlInMillis = 172800000;
        }
        this.extendOnWrite = segmentConfig.extend_on_write;
        this.orgId = orgId;
	}

    get(key)
    {
        return new Promise((resolve, reject) => {
            console.log(key, "fetch.from.cache");
            this.segment.get(key)
            .then((cachedValue) => {
                if(cachedValue.cache_value != null)
                {
                    resolve({key: key, value: JSON.parse(cachedValue.cache_value), expiry: Date.now()+parseInt(cachedValue.ttl_in_milliseconds)});
                }
                else
                {
                    resolve(null);
                }
            })
            .catch((error) => {
                console.log(error, "cache_getValue");
                reject(error);
            });
        });
    }

    put(key, value, isRepeat)
    {
        return new Promise((resolve, reject) => {
            if(this.mock)
            {
                console.log("dummy insert cache " + key + " - " + JSON.stringify(value) + " - Expires in " +(this.ttlInMillis/(1000*60*60)), "cache.put");
                resolve({key: key, value: value, expiry: Date.now()+172800000});
            }
            else
            {
                let ttl = null;
                if(!isRepeat || this.extendOnWrite)
                {
                    ttl = this.ttlInMillis/(1000*60*60);
                }
                console.log("insert cache " + key + " - " + JSON.stringify(value) + " - Expires in " +(this.ttlInMillis/(1000*60*60)), "cache.put");
                this.segment.update(key, JSON.stringify(value), ttl)
                .then((cachedValue) => {
                    resolve({key: key, value: value, expiry: Date.now()+parseInt(cachedValue.ttl_in_milliseconds)});
                })
                .catch((error) => {
                    console.log(error, "cache_putValue");
                    reject(error);
                });
            }
        });
    }

    delete(key)
    {
        return new Promise((resolve, reject) => {
            if(this.mock)
            {
                console.log("dummy delete cache " + key, "cache.delete");
                resolve(true);
            }
            else
            {
                console.log("delete cache " + key, "cache.delete");
                this.segment.delete(key)
                .then((cachedValue) => {
                    resolve(true);
                })
                .catch((error) => {
                    console.log(error, "cache_deleteValue");
                    reject(error);
                });
            }
        });
    }

    appendToValue(key, value)
    {
        return new Promise((resolve, reject) => {
            this.get(key)
            .then((cacheValue) => {
                let arrayInCache = [];
                if(cacheValue != null && cacheValue.value != null && Array.isArray(cacheValue.value))
                {
                    arrayInCache = cacheValue.value;
                }
                if(arrayInCache.includes(value))
                {
                    resolve({key: key, value: arrayInCache, expiry: cacheValue.expiry});
                }
                else
                {
                    let isRepeat = false;
                    if(arrayInCache.length > 0)
                    {
                        isRepeat = true;
                    }
                    arrayInCache.push(value);
                    this.put(key, arrayInCache, isRepeat)
                    .then((appendedCache) => {
                        resolve(appendedCache);
                    })
                    .catch((error) => {
                        reject(error);
                    });
                }
            })
            .catch((error) => {
                reject(error);
            });
        });
    }

    removeFromValue(key, value)
    {
        return new Promise((resolve, reject) => {
            this.get(key)
            .then((cacheValue) => {
                let arrayInCache = [];
                if(cacheValue != null && cacheValue.value != null && Array.isArray(cacheValue.value))
                {
                    arrayInCache = cacheValue.value;
                }
                if(arrayInCache.includes(value))
                {
                    arrayInCache.splice(arrayInCache.indexOf(value), 1);
                    this.put(key, arrayInCache, true)
                    .then((appendedCache) => {
                        resolve(appendedCache);
                    })
                    .catch((error) => {
                        reject(error);
                    });
                }
                else
                {
                    resolve({key: key, value: arrayInCache, expiry: cacheValue.expiry});
                }
            })
            .catch((error) => {
                reject(error);
            });
        });
    }

    getValue(key)
    {
        return new Promise((resolve, reject) => {
            this.get(key)
            .then((cacheValue) => {
                if(cacheValue != null)
                {
                    resolve(cacheValue.value);
                }
                else
                {
                    resolve(null);
                }
            })
            .catch((error) => {
                reject(error);
            });
        });
    }

    getFromOrgMap(key)
    {
        return new Promise((resolve, reject) => {
            this.get(this.orgId)
            .then((cacheValue) => {
                let mapInCache = {};
                if(cacheValue != null && cacheValue.value != null && typeof (cacheValue.value) === "object")
                {
                    mapInCache = cacheValue.value;
                }
                this.orgMap = mapInCache;
                resolve(mapInCache[key]);
            })
            .catch((error) => {
                reject(error);
            });
        });
    }

    putInOrgMap(key, value)
    {
        return new Promise((resolve, reject) => {
            if(this.orgMap != null)
            {
                this.actuallyPutInOrgMap(this.orgMap, key, value, resolve, reject);
            }
            else
            {
                this.get(this.orgId)
                .then((cacheValue) => {
                    let mapInCache = {};
                    if(cacheValue != null && cacheValue.value != null && typeof (cacheValue.value) === "object")
                    {
                        mapInCache = cacheValue.value;
                    }
                    this.actuallyPutInOrgMap(mapInCache, key, value, resolve, reject);
                })
                .catch((error) => {
                    reject(error);
                });
            }
        });
    }

    actuallyPutInOrgMap(mapInCache, key, value, resolve, reject)
    {
        let isRepeat = false;
        if(Object.keys(mapInCache).length > 0)
        {
            isRepeat = true;
        }
        if(value != null)
        {
            mapInCache[key] = value;
        }
        else
        {
            delete mapInCache[key];
        }
        this.put(this.orgId, mapInCache, isRepeat)
        .then((updatedCache) => {
            resolve(updatedCache);
        })
        .catch((error) => {
            reject(error);
        });
    }
}

module.exports = Cache;