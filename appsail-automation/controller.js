const Agent = require("./agents/automation/agent");
const OrderAgent = require('./agents/order automation/agent');
const ButtonAgent = require('./agents/button click automation/agent')

class Controller
{
    constructor(req)
    {
        this.req = req;
        this.mock = false;
    }

    async processAndSendMessage(incomingMessage, mode)
    {
        try
        {
            let agent = new Agent(incomingMessage, this.req, this.mock, mode);
            return await agent.sendNextMessage();
        }
        catch(error)
        {
            throw error;
        }
    }

    async processOrderFlow(incomingMessage, configs)
    {
        try
        {
            let agent = new OrderAgent(incomingMessage, this.req, this.mock, configs);
            return await agent.sendNextMessage();
        }
        catch(error)
        {
            throw error;
        }
    }

    async processButtonClickFlow(incomingMessage, configs)
    {
        try
        {
            let agent = new ButtonAgent(incomingMessage, this.req, this.mock, configs);
            return await agent.sendNextMessage();
        }
        catch(error)
        {
            throw error;
        }
    }
}

module.exports = Controller;