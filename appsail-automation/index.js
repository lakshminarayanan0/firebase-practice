const express = require('express');
const Controller = require('./controller');
const port = process.env.X_ZOHO_CATALYST_LISTEN_PORT || 3060;
const app = express();

app.use(express.json());

app.get("/", (req,res) => 
{
    res.send("Current time : " + new Date());
})

app.post("/agent", (req, res) => {
    const allowedModes = ["production", "development"];
    const mode = (req.query.mode && allowedModes.includes(req.query.mode)) ? req.query.mode : allowedModes[0];
    res.status(200).json({success: true});
    let data = req.body;
    if(data)
    {
        new Controller(req).processAndSendMessage(data, mode).then((response) => {
            console.log("::: response ::: ", JSON.stringify(response));
        })
        .catch((error) => {
            console.log("error", error);
        });
    }
});

app.post("/agent/orders", (req, res) => {
    const allowedModes = ["production", "development"];
    const allowedCatalogTypes = ["multi", "single"];
    const configs = {
        mode: (req.query.mode && allowedModes.includes(req.query.mode)) ? req.query.mode : allowedModes[0],
        catalog_id: req.query.catalog_id || null,
        catalog_type: (req.query.catalog_type && allowedCatalogTypes.includes(req.query.catalog_type) ? req.query.catalog_type : null),
        org: req.query.org || null
    };
    res.status(200).json({success: true});
    let data = req.body;
    if(data)
    {
        new Controller(req).processOrderFlow(data, configs).then((response) => {
            console.log("::: response ::: ", JSON.stringify(response));
        })
        .catch((error) => {
            console.log("error", error);
        });
    }
});

app.post("/agent/buttons", (req, res) => {
    const allowedModes = ["production", "development"];
    const configs = {
        mode: (req.query.mode && allowedModes.includes(req.query.mode)) ? req.query.mode : allowedModes[0],
        org: req.query.org || null,
        amount: req.query.amount || null
    };
    res.status(200).json({success: true});
    let data = req.body;
    if(data)
    {
        new Controller(req).processButtonClickFlow(data, configs).then((response) => {
            console.log("::: response ::: ", JSON.stringify(response));
        })
        .catch((error) => {
            console.log("error", error);
        });
    }
});

app.use((req, res) => 
{
    res.status(404).send('Not Found');
});

app.listen(port, () => 
{
    console.log(`Server running at http://localhost:${port}`);
});