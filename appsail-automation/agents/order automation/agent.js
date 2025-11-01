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
    INITIAL: "initial",
    AWAITING_MAIN_SELECTION: "awaiting_main_selection",
    AWAITING_ORDER: "awaiting_order",
    AWAITING_RECHARGE_AMOUNT: "awaiting_recharge_amount",
    AWAITING_PAYMENT: "awaiting_payment",
    AWAITING_WALLET_TOPUP_SELECTION: "awaiting_wallet_topup_selection",
    COMPLETED: "completed"
};

// Catalog configuration
// const CATALOG_CONFIG = {
//     catalog_id: "24234975512799386",
//     header: "Welcome to store",
//     caption: "Check out today's top selling products.",
//     footer: "Buy now",
//     products: [
//         {
//             section: "Dairy",
//             product_codes: ["paneer-2", "milk-2", "ghee-1"]
//         },
//         {
//             section: "Grocery",
//             product_codes: ["kuamolie9m"]
//         }
//     ]
// };

const getCatalogConfig = (catalog_id, catalog_type) => {
    let catalogConfig = {
        header: "Welcome to store",
        caption: "Check out today's top selling products.",
        footer: "Buy now"
    };
    if(catalog_id && catalog_type)
    {
        catalogConfig.catalog_id = catalog_id;
        if(catalog_type === "multi")
        {
            catalogConfig.products = [
                {
                    section: "Dairy",
                    product_codes: ["paneer-2", "milk-2", "ghee-1"]
                }
            ]
        }
        else if(catalog_type === "single")
        {
            catalogConfig.product_code = "paneer-2";
        }
    }
    return catalogConfig;
};

// Payment gateway configuration
const PAYMENT_CONFIG = {
    type: "razorpay",
    name: "RazorPayTest"
};

// Message constants
const MESSAGES = {
    MAIN_MENU: (name) => `Hi ${name}, welcome to Akshayakalpa! How can I help you today?`,
    INVALID_OPTION: "Please choose a valid option.",
    RECHARGE_AMOUNT_PROMPT: "Please choose the amount to top up your wallet.",
    RECHARGE_DESCRIPTION: (amount, balance) => `Your order total is ₹${amount}, but your wallet only has ₹${balance}. Please recharge your wallet to place the order.`,
    PAYMENT_SUCCESS_STANDALONE: (amount, balance) => `Top up successful! ₹${amount} has been added to your wallet. Your new balance is ₹${balance.toFixed(2)}.`,
    PAYMENT_SUCCESS_ORDER: (rechargedAmount, totalOrderAmount, balance) => `Top up successful! ₹${rechargedAmount} has been added to your wallet.\n\nYour order has also been confirmed and ₹${totalOrderAmount} has been debited. Your new wallet balance is ₹${balance.toFixed(2)}.\n\nYour order will be delivered shortly.`,
    PAYMENT_SUCCESS_STILL_INSUFFICIENT: (amount) => `Top up successful! ₹${amount} has been added to your wallet.\n\nHowever, your wallet balance is still insufficient. Please top up your wallet and place your order again.`,
    PAYMENT_FAILED: "Top up failed. Please try again later.",
    PAYMENT_FAILED_ORDER: "Top up failed. Please try topping up your wallet and placing your order later again.",
    ORDER_SUCCESS: (balance) => `Your order is confirmed! It will be delivered to your default address in sometime. Your new wallet balance is ₹${balance.toFixed(2)}.`,
    INSUFFICIENT_BALANCE: (walletBalance, orderTotal) => `Your order total is ₹${orderTotal}, but your wallet only has ₹${walletBalance}. Please recharge your wallet to place the order again.`,
    ORDER_CANCELLED: "Order has been abandoned.",
    TOPUP_PROMPT: "Please top up your wallet and place your order again."
};

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
        this.catalog_id = configs.catalog_id;
        this.catalog_type = configs.catalog_type;
        this.org = configs.org;
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

    async getCustomer(phone) 
    {
        let model = Model.Customer.getModel();
        let query = Model.Customer.getQueryByMobile(phone, this.org);
        let [customers] = await this.datastore.selectRecords(model, query);
        if(customers.length > 0)
        {
            return customers[0];
        }
        else
        {
            return await this.createCustomer(phone);
        }
    }

    async createCustomer(phone)
    {
        const [createdCustomer] = await this.datastore.insertRecords([new Model.Customer({mobile: phone, org: this.org})]);
        return createdCustomer;
    }

    async updateCustomerWallet(customer, newBalance) 
    {
        const oldBalance = customer.wallet;
        customer.wallet = newBalance;
        let [updated] = await this.datastore.updateRecords([customer]);
        console.log("::: wallet updated ::: ", JSON.stringify({customer_id: customer.id, old_balance: oldBalance, new_balance: newBalance}));
        return updated;
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
                current_state: STATES.INITIAL,
                last_message_type: null,
                last_buttons: [],
                pending_order: null,
                pending_recharge_amount: null,
                is_standalone_recharge: false,
                conversation_history: []
            };
            if(this.incomingMessage.content_type === "order")
            {
                state.current_state = STATES.AWAITING_ORDER;
            }
        }
        state.customer = await this.getCustomer(this.cacheKey);
        return state;
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

    buildCatalogMessage() 
    {
        return {
            to: this.cacheKey,
            content_type: "catalog",
            catalog: getCatalogConfig(this.catalog_id, this.catalog_type)
        };
    }

    buildOrderDetails(amount, description) 
    {
        return {
            to: this.cacheKey,
            content_type: "order_details",
            order_details: {
                text: description,
                header: "Wallet Recharge",
                reference_id: `recharge_${Date.now()}`,
                payment_gateway: PAYMENT_CONFIG,
                total_amount: amount,
                products: [
                    {
                        name: `Wallet Recharge ₹${amount}`,
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

    async handleInitialMessage(state) 
    {
        const buttons = [
            {text: "Top Selling Products", id: "top_selling_products"},
            {text: "Top up Wallet", id: "top_up_wallet"}
        ];

        state.current_state = STATES.AWAITING_MAIN_SELECTION;
        state.last_message_type = "selection_request";
        state.last_buttons = buttons;

        this.logConversation(state, "agent", "selection_request", "Main menu");
        await this.saveConversationState(state);
        return this.buildSelectionRequest(MESSAGES.MAIN_MENU(this.contact?.label || ""), buttons);
    }

    async handleMainSelection(state) 
    {
        const validation = this.validateIncomingMessage("selection", state.last_buttons);
        
        if(!validation.valid)
        {
            this.logConversation(state, "agent", "selection_request", JSON.stringify({reason: validation.reason, action: "retry"}));
            await this.saveConversationState(state);
            return this.buildSelectionRequest(`${MESSAGES.INVALID_OPTION}\n\n${MESSAGES.MAIN_MENU(this.contact?.label || "")}`, state.last_buttons);
        }

        const selection = this.incomingMessage.selection;
        this.logConversation(state, "user", "selection", JSON.stringify(selection));

        if(selection.text === "Top Selling Products")
        {
            state.current_state = STATES.AWAITING_ORDER;
            state.last_message_type = "catalog";
            state.last_buttons = [];
            state.is_standalone_recharge = false;
            this.logConversation(state, "agent", "catalog", "Product catalog");
            await this.saveConversationState(state);
            return this.buildCatalogMessage();
        }
        else if(selection.text === "Top up Wallet")
        {
            state.is_standalone_recharge = true;
            return await this.handleRechargeWalletFlow(state);
        }
    }

    async handleRechargeWalletFlow(state) 
    {
        const buttons = [
            {text: "Rs. 1", id: "recharge_1"},
            {text: "Rs. 3", id: "recharge_3"},
            {text: "Rs. 5", id: "recharge_5"}
        ];

        state.current_state = STATES.AWAITING_RECHARGE_AMOUNT;
        state.last_message_type = "selection_request";
        state.last_buttons = buttons;

        this.logConversation(state, "agent", "selection_request", "Recharge amount selection");
        await this.saveConversationState(state);

        return this.buildSelectionRequest(MESSAGES.RECHARGE_AMOUNT_PROMPT, buttons);
    }

    async handleRechargeAmountSelection(state) 
    {
        const validation = this.validateIncomingMessage("selection", state.last_buttons);
        
        if(!validation.valid)
        {
            this.logConversation(state, "agent", "selection_request", JSON.stringify({reason: validation.reason, action: "retry"}));
            await this.saveConversationState(state);
            return this.buildSelectionRequest(`${MESSAGES.INVALID_OPTION}\n\n${MESSAGES.RECHARGE_AMOUNT_PROMPT}`, state.last_buttons);
        }

        const selection = this.incomingMessage.selection;
        this.logConversation(state, "user", "selection", JSON.stringify(selection));

        const amountMap = {
            "recharge_1": 1,
            "recharge_3": 3,
            "recharge_5": 5
        };
        const amount = amountMap[selection.text.toLowerCase().replace("rs. ", "recharge_")];

        state.pending_recharge_amount = amount;
        state.current_state = STATES.AWAITING_PAYMENT;
        state.last_message_type = "order_details";
        state.last_buttons = [];

        this.logConversation(state, "agent", "order_details", JSON.stringify({amount: amount}));
        await this.saveConversationState(state);

        return this.buildOrderDetails(amount, MESSAGES.RECHARGE_DESCRIPTION(amount, state?.customer?.wallet));
    }

    async handlePayment(state) 
    {
        const validation = this.validateIncomingMessage("payment");
        
        if(!validation.valid)
        {
            this.logConversation(state, "agent", "order_details", JSON.stringify({reason: validation.reason, action: "retry"}));
            await this.saveConversationState(state);
            return this.buildOrderDetails(state.pending_recharge_amount, MESSAGES.RECHARGE_DESCRIPTION(state.pending_recharge_amount, state?.customer?.wallet));
        }

        const payment = this.incomingMessage.payment;
        this.logConversation(state, "user", "payment", JSON.stringify(payment));

        if(payment?.transaction?.status === "success")
        {
            const customer = state.customer;
            const rechargeAmount = state.pending_recharge_amount;
            const newBalance = customer.wallet + (rechargeAmount * 10000); // mocking recharge amount multiplication for testing
            await this.updateCustomerWallet(customer, newBalance);

            if(state.pending_order)
            {
                if(newBalance >= state.pending_order.grand_total)
                {
                    const finalBalance = newBalance - state.pending_order.grand_total;
                    await this.updateCustomerWallet(customer, finalBalance);

                    this.logConversation(state, "agent", "text", JSON.stringify({type: "payment_success_order", final_balance: finalBalance}));
                    await this.clearConversationState();

                    return this.buildTextMessage(MESSAGES.PAYMENT_SUCCESS_ORDER(rechargeAmount, state.pending_order.grand_total, finalBalance), true);
                }
                else
                {
                    const buttons = [
                        {text: "Top up Wallet", id: "top_up_wallet"},
                        {text: "Cancel Order", id: "cancel_order"}
                    ];

                    state.current_state = STATES.AWAITING_WALLET_TOPUP_SELECTION;
                    state.last_message_type = "selection_request";
                    state.last_buttons = buttons;
                    state.pending_recharge_amount = null;
                    state.is_standalone_recharge = false;

                    this.logConversation(state, "agent", "selection_request", JSON.stringify({type: "still_insufficient", new_balance: newBalance}));
                    await this.saveConversationState(state);

                    return this.buildSelectionRequest(MESSAGES.PAYMENT_SUCCESS_STILL_INSUFFICIENT(rechargeAmount), buttons);
                }
            }
            else
            {
                this.logConversation(state, "agent", "text", JSON.stringify({type: "payment_success_standalone", new_balance: newBalance}));
                await this.clearConversationState();

                return this.buildTextMessage(MESSAGES.PAYMENT_SUCCESS_STANDALONE(rechargeAmount, newBalance), true);
            }
        }
        else
        {
            if(state.pending_order)
            {
                const buttons = [
                    {text: "Top up Wallet", id: "top_up_wallet"},
                    {text: "Cancel Order", id: "cancel_order"}
                ];

                state.current_state = STATES.AWAITING_WALLET_TOPUP_SELECTION;
                state.last_message_type = "selection_request";
                state.last_buttons = buttons;
                state.pending_recharge_amount = null;
                state.is_standalone_recharge = false;

                this.logConversation(state, "agent", "selection_request", JSON.stringify({type: "payment_failed_order"}));
                await this.saveConversationState(state);

                return this.buildSelectionRequest(MESSAGES.PAYMENT_FAILED_ORDER, buttons);
            }
            else
            {
                this.logConversation(state, "agent", "text", JSON.stringify({type: "payment_failed_standalone"}));
                await this.clearConversationState();

                return this.buildTextMessage(MESSAGES.PAYMENT_FAILED, true);
            }
        }
    }

    async handleOrder(state) 
    {
        const validation = this.validateIncomingMessage("order");
        
        if(!validation.valid)
        {
            this.logConversation(state, "agent", "catalog", JSON.stringify({reason: validation.reason, action: "retry"}));
            await this.saveConversationState(state);
            return this.buildCatalogMessage();
        }

        const order = this.incomingMessage.order;
        this.logConversation(state, "user", "order", JSON.stringify({grand_total: order.grand_total, products: order.products}));

        const customer = state.customer;

        if(customer.wallet >= order.grand_total)
        {
            const newBalance = customer.wallet - order.grand_total;
            await this.updateCustomerWallet(customer, newBalance);

            this.logConversation(state, "agent", "text", JSON.stringify({type: "order_success", new_balance: newBalance}));
            await this.clearConversationState();

            return this.buildTextMessage(MESSAGES.ORDER_SUCCESS(newBalance), true);
        }
        else
        {
            state.pending_order = order;
            const buttons = [
                {text: "Top up Wallet", id: "top_up_wallet"},
                {text: "Cancel Order", id: "cancel_order"}
            ];

            state.current_state = STATES.AWAITING_WALLET_TOPUP_SELECTION;
            state.last_message_type = "selection_request";
            state.last_buttons = buttons;
            state.is_standalone_recharge = false;

            this.logConversation(state, "agent", "selection_request", JSON.stringify({type: "insufficient_balance", wallet: customer.wallet, order_total: order.grand_total}));
            await this.saveConversationState(state);

            return this.buildSelectionRequest(MESSAGES.INSUFFICIENT_BALANCE(customer.wallet, order.grand_total), buttons);
        }
    }

    async handleWalletTopupSelection(state) 
    {
        const validation = this.validateIncomingMessage("selection", state.last_buttons);
        
        if(!validation.valid)
        {
            this.logConversation(state, "agent", "selection_request", JSON.stringify({reason: validation.reason, action: "retry"}));
            await this.saveConversationState(state);
            return this.buildSelectionRequest(`${MESSAGES.INVALID_OPTION}\n\n${MESSAGES.TOPUP_PROMPT}`, state.last_buttons);
        }

        const selection = this.incomingMessage.selection;
        this.logConversation(state, "user", "selection", JSON.stringify(selection));

        if(selection.text === "Top up Wallet")
        {
            state.is_standalone_recharge = false;
            return await this.handleRechargeWalletFlow(state);
        }
        else if(selection.text === "Cancel Order")
        {
            this.logConversation(state, "agent", "text", JSON.stringify({type: "order_cancelled"}));
            await this.clearConversationState();

            return this.buildTextMessage(MESSAGES.ORDER_CANCELLED, true);
        }
    }

    async routeMessage(state) 
    {
        console.log("::: routing message ::: ", JSON.stringify({current_state: state.current_state, incoming_type: this.incomingMessage?.content_type}));

        switch(state.current_state)
        {
            case STATES.INITIAL:
                return await this.handleInitialMessage(state);

            case STATES.AWAITING_MAIN_SELECTION:
                return await this.handleMainSelection(state);

            case STATES.AWAITING_RECHARGE_AMOUNT:
                return await this.handleRechargeAmountSelection(state);

            case STATES.AWAITING_PAYMENT:
                return await this.handlePayment(state);

            case STATES.AWAITING_ORDER:
                return await this.handleOrder(state);

            case STATES.AWAITING_WALLET_TOPUP_SELECTION:
                return await this.handleWalletTopupSelection(state);

            default:
                return await this.handleInitialMessage(state);
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