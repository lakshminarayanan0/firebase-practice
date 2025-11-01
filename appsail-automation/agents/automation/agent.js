const Utils = require("../../framework/utils");
const Cache = require("../../framework/cache");

const CACHE_SEGMENTS = {
	"scripts": {
		"id": "1721000000581077",
		"ttl_in_millis": 86400000    //24 hours
	}
};

const answersFromAgent = [
    {
        type: "text",
        message: "Hello, welcome to VME. We have precast tanks for your commercial usage.What is the length of the tank (in meters)?",
        cache_key: "length"
    },
    {
        type: "text",
        message: "What is the width of the tank (in meters)?",
        cache_key: "width"
    },
    {
        type: "text",
        message: "What is the height of the tank (in meters)?",
        cache_key: "height"
    },
    {
        type: "text",
        message: "The total capacity of the tank is {capacity} cubic meters. The approximate cost will be around Rs. {amount}. Would you like to connect with our expert to discuss further?"
    },
    {
        type: "text",
        message: "Thanks, someone from our team will connect with your shortly."
    }
];

class Agent 
{
    #mode = "prod";
    #endpoint = {
        development: "https://webhooks-10076939792.development.catalystappsail.com/v1/script_messages",
        production: "https://webhooks-10076939792.catalystappsail.com/v1/script_messages",
        local: 'http://localhost:3001/v1/script_messages'
    };
    #headers = {
        production: {
            "x-api-key": "ef7f1f69-83a3-4a06-a3e1-65d674dd5dde-025137fb2f9f2e41bc34d417695c793b",
            "x-channel-id": "24966000000322665"
        },
        development: {
            "x-api-key": "dca36bcb-9805-4604-b405-f17724ea5707-d13bbbc98f5b74b12b5767156194764f",
            "x-channel-id": "20923000000391382"
        }
    };
    constructor(payload, req, mock = false, mode = "production") 
    {
        this.payload = payload;
        this.cacheKey = payload.from.replace("+", "");
        this.req = req;
        this.mock = mock;
        this.webhookMode = mode;
        this.cache = new Cache(this.req, CACHE_SEGMENTS.scripts, null, this.mock);
    }

    getHeaders()
    {
        return this.#headers[this.webhookMode];
    }

    getEndpoint()
    {
        return this.#endpoint[this.webhookMode];
    }

    async getNextQuestion(cacheData) 
    {
        // store previous customer response if previous question had cache_key
        if(cacheData.processed_question > 0)
        {
            const prevMessage = answersFromAgent[cacheData.processed_question - 1];
            if(prevMessage && prevMessage.cache_key)
            {
                cacheData.customer_data[prevMessage.cache_key] = this.payload.messages[0].message;
            }
        }

        let handOff = false;
        if(cacheData.processed_question >= answersFromAgent.length)
        {
            handOff = true;
        }
        cacheData.processed_question++;
        let index = cacheData.processed_question - 1;
        let nextMessage = answersFromAgent[index];

        // calculate and replace placeholders when data available
        if(nextMessage && nextMessage.message.includes("{capacity}"))
        {
            let { length, width, height } = cacheData.customer_data;
            if(length && width && height)
            {
                const capacity = parseFloat(length) * parseFloat(width) * parseFloat(height);
                const amount = capacity * 10;
                nextMessage = {
                    ...nextMessage,
                    message: nextMessage.message
                        .replace("{capacity}", capacity.toFixed(2))
                        .replace("{amount}", amount.toFixed(2))
                };
            }
        }

        cacheData.messages.push({ origin: "agent", text: nextMessage.message });
        await this.cache.put(this.cacheKey, cacheData, false);

        if(cacheData.processed_question >= answersFromAgent.length) 
        {
            handOff = true;
        }

        return this.buildPayload(nextMessage, this.cacheKey, handOff);
    }

    buildPayload(messageObj, to, hand_off) 
    {
        let payload = {
            "to": to,
            "content_type": messageObj.type,
            "text": messageObj.message
        };
        if(messageObj.type === "file" && messageObj.file) 
        {
            payload.file = messageObj.file;
        }
        if(messageObj.type === "audio" && messageObj.audio) 
        {
            payload.audio = messageObj.audio;
        }
        if(hand_off) 
        {
            payload.conversation_state = {
                status: "completed",
                hand_off: true
            };
        }
        return payload;
    }

    async sendNextMessage()
    {
        let cacheData = await this.cache.getValue(this.cacheKey);
        console.log("::: cache data ::: ", JSON.stringify(cacheData));
        console.log("::: cache key ::: ", this.cacheKey);
        console.log("::: payload ::: ", JSON.stringify(this.payload));
        if(this.payload && this.payload.terminated && cacheData)
        {
            await this.cache.delete(this.cacheKey);
            return null;
        }
        if(cacheData == null)
        {
            cacheData = {
                processed_question: 0,
                customer_data: {},
                messages: [],
                errors: []
            };
        }

        try
        {
            let payload = await this.getNextQuestion(cacheData);
            let response = await Utils.post(this.getEndpoint(), payload, this.getHeaders());
            console.log("::: response from webhook ::: ", JSON.stringify(response));
            if(payload.conversation_state?.hand_off)
            {
                await this.cache.delete(this.cacheKey);
            }
            return payload;
        }
        catch(error)
        {
            cacheData.errors.push({
                origin: "agent",
                question_index: cacheData.processed_question,
                reason: error.message || "unknown"
            });
            await this.cache.put(this.cacheKey, cacheData, false);
            Utils.logError(error, "agent.sendMessage");
            throw error;
        }
    }
}

module.exports = Agent;