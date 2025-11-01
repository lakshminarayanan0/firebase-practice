const Utils = require("../../framework/utils");
const Cache = require("../../framework/cache");
const Datastore = require("../../framework/datastore");
const Model = require('../../framework/model');

const CACHE_SEGMENTS = {
    "scripts": {
        "id": "1721000000581077",
        "ttl_in_millis": 86400000    //24 hours
    }
};

// State definitions
const STATES = {
    AWAITING_PAYMENT_ACTION: "awaiting_payment_action",
    AWAITING_REMINDER_TIME: "awaiting_reminder_time",
    AWAITING_PAYMENT_AMOUNT: "awaiting_payment_amount",
    AWAITING_PAYMENT: "awaiting_payment",
    COMPLETED: "completed"
};

// Payment gateway configuration
const PAYMENT_CONFIG = {
    type: "razorpay",
    name: "RazorPayTest"
};

// Message constants
const MESSAGES = {
    INVALID_OPTION: "Please select valid options",
    PAYMENT_REMINDER: (amount) => `You have a pending payment of ₹${amount}. What would you like to do?`,
    REMINDER_TIME_PROMPT: "When do you want to be reminded again?",
    REMINDER_CONFIRMED: "Sure, we will remind you.",
    PAYMENT_AMOUNT_PROMPT: (amount) => `How much would you like to pay? (Total due: ₹${amount})`,
    ORDER_DESCRIPTION: (amount) => `Payment for invoice amount ₹${amount}`,
    PAYMENT_SUCCESS: "Thanks for your payment.",
    PAYMENT_FAILED: "Payment failed. Please try again later."
};

// Amount to pay
const AMOUNT_TO_PAY = 90;

class Agent 
{
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
            "x-api-key": "7997ae97-5ad3-4ba9-a3e3-33a8c2afafb5-fc1140d300d44993b86c3e835d1f3935",
            "x-channel-id": "20923000000751536"
        }
    };

    constructor(payload, req, mock = false, configs = {}) 
    {
        this.payload = payload;
        this.cacheKey = payload.from.replace("+", "");
        this.contact = payload.contact;
        this.req = req;
        this.mock = mock;
        this.webhookMode = configs.mode;
        this.org = configs.org;
        this.amount = configs.amount || AMOUNT_TO_PAY;
        this.cache = new Cache(this.req, CACHE_SEGMENTS.scripts, null, this.mock);
        this.datastore = new Datastore(req, mock);
        this.incomingMessage = payload.messages?.[payload?.messages?.length - 1];
    }

    getHeaders() 
    {
        return this.#headers[this.webhookMode];
    }

    getEndpoint() 
    {
        return this.#endpoint[this.webhookMode];
    }

    async getConversationState(payload) 
    {
        let state = await this.cache.getValue(this.cacheKey);
        if(payload.terminated)
        {
            await this.cache.delete(this.cacheKey);
            return null;
        }
        if(state == null)
        {
            state = {
                current_state: STATES.AWAITING_PAYMENT_ACTION,
                last_message_type: null,
                last_buttons: [],
                pending_amount: null,
                selected_payment_amount: null,
                conversation_history: []
            };
        }
        state.customer = await this.getCustomer();
        return state;
    }

    async getCustomer()
    {
        let model = Model.Customer.getModel();
        let query = Model.Customer.getQueryByMobile(this.cacheKey, this.org);
        let [customers] = await this.datastore.selectRecords(model, query);
        if(customers.length > 0)
        {
            return customers[0];
        }
        else
        {
            return null;
        }
    }

    async saveConversationState(state) 
    {
        await this.cache.put(this.cacheKey, state, false);
    }

    async clearConversationState() 
    {
        await this.cache.delete(this.cacheKey);
    }

    logConversation(state, origin, messageType, content) 
    {
        state.conversation_history.push({
            timestamp: new Date().toISOString(),
            origin: origin,
            type: messageType,
            content: content
        });
    }

    validateIncomingMessage(expectedType, validButtons = []) 
    {
        const incomingMessage = this.incomingMessage;
        
        if(!incomingMessage || incomingMessage.content_type !== expectedType)
        {
            return {valid: false, reason: "invalid_type"};
        }

        if(expectedType === "selection")
        {
            const selection = incomingMessage.selection;
            if(!selection)
            {
                return {valid: false, reason: "missing_selection"};
            }

            const selectionText = selection.text?.trim().toLowerCase();
            const isValid = validButtons.some((btn) => btn.text.toLowerCase() === selectionText);

            if(!isValid)
            {
                return {valid: false, reason: "invalid_selection"};
            }
        }

        return {valid: true};
    }

    buildSelectionRequest(text, buttons, footer = null) 
    {
        const payload = {
            to: this.cacheKey,
            content_type: "selection_request",
            selection_request: {
                caption: text,
                buttons: buttons
            }
        };
        if(footer)
        {
            payload.selection_request.footer = footer;
        }
        return payload;
    }

    buildTextMessage(text, handOff = false) 
    {
        const payload = {
            to: this.cacheKey,
            content_type: "text",
            text: text
        };
        if(handOff)
        {
            payload.conversation_state = {
                status: "completed",
                hand_off: true
            };
        }
        return payload;
    }

    buildOrderDetails(amount, description, referenceId) 
    {
        return {
            to: this.cacheKey,
            content_type: "order_details",
            order_details: {
                text: description,
                header: "Payment",
                reference_id: referenceId || `payment_${Date.now()}`,
                payment_gateway: PAYMENT_CONFIG,
                total_amount: amount,
                products: [
                    {
                        name: `Payment ₹${amount}`,
                        amount: amount,
                        quantity: 1
                    }
                ],
                subtotal: amount,
                tax: 0,
                shipping: 0,
                discount: 0
            }
        };
    }

    async handlePaymentAction(state) 
    {
        const buttons = [
            {text: "Pay now", id: "pay_now"},
            {text: "Remind later", id: "remind_later"}
        ];

        const validation = this.validateIncomingMessage("selection", buttons);
        
        if(!validation.valid)
        {
            this.logConversation(state, "agent", "selection_request", JSON.stringify({reason: validation.reason, action: "retry"}));
            await this.saveConversationState(state);
            return this.buildSelectionRequest(MESSAGES.INVALID_OPTION, buttons);
        }

        const selection = this.incomingMessage.selection;
        this.logConversation(state, "user", "selection", JSON.stringify(selection));

        if(selection.text === "Pay now")
        {
            return await this.handlePayNow(state);
        }
        else if(selection.text === "Remind later")
        {
            return await this.handleRemindLater(state);
        }
    }

    async handlePayNow(state) 
    {
        const amount = parseFloat(state.customer?.amount || this.amount);
        const buttons = [
            {text: `Rs. ${amount}`, id: `amount_${amount}`},
            {text: `Rs. ${Math.floor(amount / 2)}`, id: `amount_${Math.floor(amount / 2)}`},
            {text: `Rs. ${Math.floor(amount / 3)}`, id: `amount_${Math.floor(amount / 3)}`}
        ];

        state.current_state = STATES.AWAITING_PAYMENT_AMOUNT;
        state.last_message_type = "selection_request";
        state.last_buttons = buttons;

        this.logConversation(state, "agent", "selection_request", "Payment amount selection");
        await this.saveConversationState(state);

        return this.buildSelectionRequest(MESSAGES.PAYMENT_AMOUNT_PROMPT(amount), buttons);
    }

    async handleRemindLater(state) 
    {
        const buttons = [
            {text: "Tomorrow", id: "remind_tomorrow"},
            {text: "3 days", id: "remind_3days"},
            {text: "5 days", id: "remind_5days"}
        ];

        state.current_state = STATES.AWAITING_REMINDER_TIME;
        state.last_message_type = "selection_request";
        state.last_buttons = buttons;

        this.logConversation(state, "agent", "selection_request", "Reminder time selection");
        await this.saveConversationState(state);

        return this.buildSelectionRequest(MESSAGES.REMINDER_TIME_PROMPT, buttons);
    }

    async handleReminderTime(state) 
    {
        const validation = this.validateIncomingMessage("selection", state.last_buttons);
        
        if(!validation.valid)
        {
            this.logConversation(state, "agent", "selection_request", JSON.stringify({reason: validation.reason, action: "retry"}));
            await this.saveConversationState(state);
            return this.buildSelectionRequest(MESSAGES.INVALID_OPTION, state.last_buttons);
        }

        const selection = this.incomingMessage.selection;
        this.logConversation(state, "user", "selection", JSON.stringify(selection));

        this.logConversation(state, "agent", "text", JSON.stringify({type: "reminder_confirmed", selection: selection.text}));
        await this.clearConversationState();

        return this.buildTextMessage(MESSAGES.REMINDER_CONFIRMED, true);
    }

    async handlePaymentAmount(state) 
    {
        const validation = this.validateIncomingMessage("selection", state.last_buttons);
        
        if(!validation.valid)
        {
            this.logConversation(state, "agent", "selection_request", JSON.stringify({reason: validation.reason, action: "retry"}));
            await this.saveConversationState(state);
            return this.buildSelectionRequest(MESSAGES.INVALID_OPTION, state.last_buttons);
        }

        const selection = this.incomingMessage.selection;
        this.logConversation(state, "user", "selection", JSON.stringify(selection));

        const amountText = selection.text.replace("Rs. ", "");
        const amount = parseInt(amountText);

        state.selected_payment_amount = amount;
        state.current_state = STATES.AWAITING_PAYMENT;
        state.last_message_type = "order_details";
        state.last_buttons = [];

        this.logConversation(state, "agent", "order_details", JSON.stringify({amount: amount}));
        await this.saveConversationState(state);

        return this.buildOrderDetails(amount, MESSAGES.ORDER_DESCRIPTION(amount), state.customer?.reference_id);
    }

    async handlePayment(state) 
    {
        const validation = this.validateIncomingMessage("payment");
        
        if(!validation.valid)
        {
            this.logConversation(state, "agent", "order_details", JSON.stringify({reason: validation.reason, action: "retry"}));
            await this.saveConversationState(state);
            return this.buildOrderDetails(state.selected_payment_amount, MESSAGES.ORDER_DESCRIPTION(state.selected_payment_amount), state.customer?.reference_id);
        }

        const payment = this.incomingMessage.payment;
        this.logConversation(state, "user", "payment", JSON.stringify(payment));

        if(payment?.transaction?.status === "success")
        {
            this.logConversation(state, "agent", "text", JSON.stringify({type: "payment_success", amount: state.selected_payment_amount}));
            await this.clearConversationState();

            return this.buildTextMessage(MESSAGES.PAYMENT_SUCCESS, true);
        }
        else
        {
            this.logConversation(state, "agent", "text", JSON.stringify({type: "payment_failed"}));
            await this.clearConversationState();
            return this.buildTextMessage(MESSAGES.PAYMENT_FAILED, true);
        }
    }

    async routeMessage(state) 
    {
        console.log("::: routing message ::: ", JSON.stringify({current_state: state.current_state, incoming_type: this.incomingMessage?.content_type}));

        switch(state.current_state)
        {
            case STATES.AWAITING_PAYMENT_ACTION:
                return await this.handlePaymentAction(state);

            case STATES.AWAITING_REMINDER_TIME:
                return await this.handleReminderTime(state);

            case STATES.AWAITING_PAYMENT_AMOUNT:
                return await this.handlePaymentAmount(state);

            case STATES.AWAITING_PAYMENT:
                return await this.handlePayment(state);

            default:
                return await this.handlePaymentAction(state);
        }
    }

    async sendMessage(payload) 
    {
        try
        {
            if(this.mock)
            {
                console.log("::: mock send message ::: ", JSON.stringify(payload));
                return payload;
            }
            else
            {
                const response = await Utils.post(this.getEndpoint(), payload, this.getHeaders());
                console.log("::: webhook response ::: ", JSON.stringify(response));
                return response;
            }
        }
        catch(error)
        {
            console.error("::: send message error ::: ", JSON.stringify({error: error.message, stack: error.stack}));
            throw error;
        }
    }

    async sendNextMessage() 
    {
        try
        {
            console.log("::: incoming payload ::: ", JSON.stringify(this.payload));
            const state = await this.getConversationState(this.payload);
            if(!state)
            {
                return null;
            }
            const payload = await this.routeMessage(state);
            await this.sendMessage(payload);
            return payload;
        }
        catch(error)
        {
            Utils.logError(error, "agent.sendMessage");
            throw error;
        }
    }
}

module.exports = Agent;