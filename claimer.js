const superagent = require('superagent');
const Eos = require('eosjs');
const config = require('./config.json');
const httpEndPoint = config.httpEndPoint;
const chainId = config.chainId;
const wif = config.wif;
const producerName = config.producerName;
const permission = config.permission;

var eos = Eos({
    httpEndpoint: httpEndPoint, chainId: chainId,
    keyProvider: wif
});


cacheRewards();
setInterval(cacheRewards, 10 * 60 * 1000 + 5000);
//////////////////////////
function cacheRewards() {
    Promise.all([getGlobal(), getProducer(producerName)]).then(([global, producer]) => {
        let bpay = (global.perblock_bucket * producer.unpaid_blocks) / global.total_unpaid_blocks / 10000;
        let vpay = (global.pervote_bucket * producer.total_votes) / (1 * global.total_producer_vote_weight) / 10000;
        if (vpay < 100) {
            vpay = 0;
        }
        let next_claim_time = 1 * producer.last_claim_time / 1000 + 24 * 60 * 60 * 1000;
        if (next_claim_time > Date.now()) {
            return 0;
        }
        return bpay + vpay;
    }).then(rewards => {
        if (rewards > 0) {
            eos.transaction({
                // ...headers,
                actions: [
                    {
                        account: 'eosio',
                        name: 'claimrewards',
                        authorization: [{
                            actor: producerName,
                            permission: permission
                        }],
                        data: {
                            owner: producerName
                        }
                    }
                ]
            }).then(res => {
                console.log(res);
            });
        }
    });
}

function getGlobal() {
    return new Promise((resolve, reject) => {
        superagent(httpEndPoint + "/v1/chain/get_table_rows")
            .set('Content-Type', 'application/json')
            .send({
                "scope": "eosio",
                "code": "eosio",
                "table": "global",
                "json": true
            })
            .end(function (err, res) {
                if (err) {
                    let msg = httpEndPoint + " , http error :" + err;
                    console.error(msg);
                    reject(msg);
                } else if (res.statusCode != 200) {
                    let msg = httpEndPoint + " status code :" + res.statusCode
                    console.error(msg);
                    //retry
                    reject(msg);
                } else {
                    let object = JSON.parse(res.text);
                    //console.log(object);
                    resolve(object.rows[0]);
                }
            });
    });
}

function getProducer(name) {
    return new Promise((resolve, reject) => {
        superagent(httpEndPoint + "/v1/chain/get_table_rows")
            .set('Content-Type', 'application/json')
            .send({
                "scope": "eosio",
                "code": "eosio",
                "table": "producers",
                "lower_bound": name,
                "limit": 1,
                "json": true
            })
            .end(function (err, res) {
                if (err) {
                    let msg = httpEndPoint + " , http error :" + err;
                    console.error(msg);
                    reject(msg);
                } else if (res.statusCode != 200) {
                    let msg = httpEndPoint + " status code :" + res.statusCode
                    console.error(msg);
                    //retry
                    reject(msg);
                } else {
                    let object = JSON.parse(res.text);
                    //console.log(object);
                    resolve(object.rows[0]);
                }
            });
    });
}

