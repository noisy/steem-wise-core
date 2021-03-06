import { assert, expect } from "chai";
import { Promise } from "bluebird";
import "mocha";
import * as _ from "lodash";

import * as fakeDataset_ from "./data/fake-blockchain.json";
const fakeDataset = fakeDataset_ as object as FakeApi.Dataset;

import { Wise, SteemOperation } from "../src/wise";
import { Api } from "../src/api/Api";
import { DirectBlockchainApi } from "../src/api/directblockchain/DirectBlockchainApi";
import { WiseRESTApi } from "../src/api/WiseRESTApi";
import { FakeApi } from "../src/api/FakeApi";
import { SteemPost } from "../src/blockchain/SteemPost";
import { SteemOperationNumber } from "../src/blockchain/SteemOperationNumber";
import { SetRules, EffectuatedSetRules } from "../src/protocol/SetRules";
import { WeightRule } from "../src/rules/WeightRule";
import { TagsRule } from "../src/rules/TagsRule";

import * as v1TestingSequence from "./data/protocol-v1-testing-sequence";
import { Rule } from "../src/rules/Rule";
import { EffectuatedSmartvotesOperation } from "../src/protocol/EffectuatedSmartvotesOperation";
import { DynamicGlobalProperties } from "../src/blockchain/DynamicGlobalProperties";
import { AccountInfo } from "../src/blockchain/AccountInfo";
import { NotFoundException } from "../src/util/NotFoundException";

describe("test/api.spec.ts", function () {
    this.timeout(10000);

    const username = "guest123";
    const postingWif = "5JRaypasxMx1L97ZUX7YuC5Psb5EAbF821kkAGtBj7xCJFQcbLg";

    const apis: Api [] = [
        new DirectBlockchainApi(username, postingWif),
        FakeApi.fromDataset(fakeDataset)
        // new WiseRESTApi(WiseRESTApi.NOISY_ENDPOINT_HOST, username, postingWif)
    ];

    apis.forEach((api: Api) => describe("api " + api.name(), () => {
        const wise = new Wise(username, api);
        /**
         * Test post loading for each api
         */
        describe("#loadPost", () => {
            it("loads correct post", () => {
                return api.loadPost("noisy", "dear-whales-please-consider-declining-all-comment-rewards-by-default-in-settings-5-reasons-to-do-that")
                    .then((post: SteemPost) => {
                        expect(post.author).to.be.equal("noisy");
                        expect(post.permlink).to.be.equal("dear-whales-please-consider-declining-all-comment-rewards-by-default-in-settings-5-reasons-to-do-that");
                        assert(post.body.indexOf("Declining a payout from a comment was possible even earlier, however it was always difficult to do that without some programming skills.") !== -1);

                        expect((JSON.parse(post.json_metadata) as SteemPost.JSONMetadata).tags)
                            .to.be.an("array").that.includes("voting").and.includes("steem").and.includes("steemit")
                            .and.has.length(3);
                    });
            });

            it("throws NotFoundException on nonexistent post", (done) => {
                api.loadPost("noisy", "nonexistent-permlink-" + Date.now())
                .then((result) => done(new Error("Should fail on nonexistent post. Got some data instead.")))
                .catch((e: Error) => {
                    if ((e as NotFoundException).notFoundException) done();
                    else done(e);
                });
            });
        });

        /**
         * Test loading rulesets
         */
        describe("#loadRulesets", () => {
            it("returns empty list if no rulesets are set (does not fall silently)", () => {
                const delegator = "steemprojects2";
                const voter = "steemprojects1";
                const moment = new SteemOperationNumber(22144254, 42, 0); // before this moment @steemprojects2 has no rules for anyone
                return api.loadRulesets(delegator, voter, moment, wise.getProtocol())
                .then(((r: SetRules) => {
                    expect(r.rulesets).to.be.an("array").that.has.length(0);
                }));
            });

            it("loads proper rules (v1)", () => {
                const delegator = v1TestingSequence.stage1_0_RulesetsUsername;
                const voter = v1TestingSequence.stage1_0_Rulesets.rulesets[0].voter;
                const moment = v1TestingSequence.stage1_2_SyncConfirmationMoment;
                return api.loadRulesets(delegator, voter, moment, wise.getProtocol())
                .then(((r: SetRules) => {
                    expect(r.rulesets).to.be.an("array").with.length(v1TestingSequence.stage1_0_Rulesets.rulesets.length);
                    for (let i = 0; i < v1TestingSequence.stage1_0_Rulesets.rulesets.length; i++) {
                        const expectedRuleset = v1TestingSequence.stage1_0_Rulesets.rulesets[i];
                        const receivedRuleset = r.rulesets[i];
                        expect(receivedRuleset.name).to.equal(expectedRuleset.name);
                        receivedRuleset.rules.forEach(rule => {
                            if (rule.type() == Rule.Type.Weight) {
                                expect((rule as WeightRule).max).to.be.equal(1);
                                expect((rule as WeightRule).min).to.be.equal(0);
                            }
                        });
                    }
                }));
            });

            it("returns no rules for non existing delegator", () => {
                const delegator = "nonexistent-" + Date.now();
                const voter = v1TestingSequence.stage1_0_Rulesets.rulesets[0].voter;
                const moment = v1TestingSequence.stage1_2_SyncConfirmationMoment;
                return api.loadRulesets(delegator, voter, moment, wise.getProtocol())
                .then(((r: SetRules) => {
                    expect(r.rulesets).to.be.an("array").with.length(0);
                }));
            });

            it("returns no rules for non existing voter", () => {
                const delegator = v1TestingSequence.stage1_0_RulesetsUsername;
                const voter = "nonexistent-" + Date.now();
                const moment = v1TestingSequence.stage1_2_SyncConfirmationMoment;
                return api.loadRulesets(delegator, voter, moment, wise.getProtocol())
                .then(((r: SetRules) => {
                    expect(r.rulesets).to.be.an("array").with.length(0);
                }));
            });

            /*it("throws NotFoundException if delegator does not exist", (done) => {
                const delegator = "nonexistent-" + Date.now();
                const voter = v1TestingSequence.stage1_0_Rulesets.rulesets[0].voter;
                const moment = v1TestingSequence.stage1_2_SyncConfirmationMoment;
                api.loadRulesets(delegator, voter, moment, wise.getProtocol())
                .then((result) => done(new Error("Should fail on nonexistent delegator. Got some data instead.")))
                .catch((e: Error) => {
                    if ((e as NotFoundException).notFoundException) done();
                    else done(e);
                });
            });

            it("throws NotFoundException if voter does not exist", (done) => {
                const delegator = v1TestingSequence.stage1_0_RulesetsUsername;
                const voter = "nonexistent-" + Date.now();
                const moment = v1TestingSequence.stage1_2_SyncConfirmationMoment;
                api.loadRulesets(delegator, voter, moment, wise.getProtocol())
                .then((result) => done(new Error("Should fail on nonexistent voter. Got some data instead.")))
                .catch((e: Error) => {
                    if ((e as NotFoundException).notFoundException) done();
                    else done(e);
                });
            });*/
        });

        describe("#sendToBlockchain", () => {
            it("Sends without error and returns non-zero SteemOperationNumber", () => {
                return api.sendToBlockchain([["vote", {
                    voter: "guest123",
                    author: "noisy",
                    permlink: "7nw1oeev",
                    weight: 5000
                }]])
                .then((son: SteemOperationNumber) => {
                    expect(son.blockNum).to.not.equal(0);
                });
            });
        });

        describe("#getLastConfirmationMoment", () => {
            it("Returns correct last confirmation moment of steemprojects3", () => {
                return api.getLastConfirmationMoment("steemprojects3", wise.getProtocol())
                .then((son: SteemOperationNumber) => {
                    expect(son.blockNum).to.be.gte(22485801);
                });
            });
        });

        describe("#loadAllRulesets", () => {
            it("Loads properly all rulesets from protocol-v1-testing-sequence", () => {
                const requiredRulesets: { ruleset: v1TestingSequence.RulesetsAtMoment, found: boolean } [] = [
                    { ruleset: v1TestingSequence.stage1_0_Rulesets, found: false },
                    { ruleset: v1TestingSequence.stage2_1_Rulesets, found: false },
                    // { ruleset: v1TestingSequence.stage3_0_Rulesets, found: false } // this is an v1 reseting set_rules. There is no easy way to port it to V2.
                ];

                return api.loadAllRulesets(v1TestingSequence.delegator, v1TestingSequence.stage3_1_SyncConfirmationMoment, wise.getProtocol())
                .then((result: EffectuatedSetRules []) => {
                    for (const sr of result) {
                        for (let i = 0; i < requiredRulesets.length; i++) {
                            if (sr.moment.isEqual_solveOpInTrxBug(requiredRulesets[i].ruleset.opNum)) {
                                requiredRulesets[i].found = true;
                            }
                        }
                    }

                    for (let i = 0; i < requiredRulesets.length; i++) {
                        expect(requiredRulesets[i].found, "requiredRulesets[" + i + "].found").to.be.true;
                    }
                });
            });

            /*it("throws NotFoundException if delegator does not exist", (done) => {
                const delegator = "nonexistent-" + Date.now();
                const moment = v1TestingSequence.stage1_2_SyncConfirmationMoment;
                api.loadAllRulesets(delegator, moment, wise.getProtocol())
                .then((result) => done(new Error("Should fail on nonexistent delegator. Got some data instead.")))
                .catch((e: Error) => {
                    if ((e as NotFoundException).notFoundException) done();
                    else done(e);
                });
            });*/
        });

        describe("#getWiseOperationsRelatedToDelegatorInBlock", () => {
            it("Loads only wise operation from block 22,485,801", () => {
                return api.getWiseOperationsRelatedToDelegatorInBlock("steemprojects3", 22485801, wise.getProtocol())
                .then((ops: EffectuatedSmartvotesOperation []) => {
                    expect(ops).to.be.an("array").with.length(1);
                    expect(ops[0].delegator, "ops[0].delegator").to.equal("steemprojects3");
                    expect(ops[0].moment.blockNum, "ops[0] block_num").to.equal(22485801);
                    expect(ops[0].moment.transactionNum, "ops[0] transaction_num").to.equal(38);
                    if (api.name() !== "FakeApi") expect(ops[0].moment.operationNum, "ops[0] operation_num").to.equal(1);
                });
            });

            it("Returns empty array if no operations are present", () => {
                const blockNum = 1;
                return api.getWiseOperationsRelatedToDelegatorInBlock("steemprojects3", blockNum, wise.getProtocol())
                .then((ops: EffectuatedSmartvotesOperation []) => {
                    expect(ops).to.be.an("array").with.length(0);
                });
            });

            it("Loads wise operations sent by voter but refering to delegator", () => {
                return api.getWiseOperationsRelatedToDelegatorInBlock("steemprojects3", 22484096, wise.getProtocol())
                .then((ops: EffectuatedSmartvotesOperation []) => {
                    expect(ops).to.be.an("array").with.length(1);
                    expect(ops[0].moment.blockNum, "ops[0] block_num").to.equal(22484096);
                    if (api.name() !== "FakeApi")  expect(ops[0].moment.operationNum, "ops[0] operation_num").to.equal(1);
                    expect(ops[0].delegator, "ops[0].delegator").to.equal("steemprojects3");
                    expect(ops[0].voter, "ops[0].voter").to.equal("guest123");
                });
            });

            it("Does not load operations sent as a voter", () => {
                return api.getWiseOperationsRelatedToDelegatorInBlock("guest123", 22484096, wise.getProtocol())
                .then((ops: EffectuatedSmartvotesOperation []) => {
                    expect(ops).to.be.an("array").with.length(0);
                });
            });

            it("Waits for future block", function () {
                this.timeout(40000);

                let blockNum: number;
                for (const api of apis) if (api.name() === "FakeApi") _.times(2, (num) => setTimeout(() => (api as FakeApi).pushFakeBlock(), 200 * num));

                return api.getDynamicGlobalProperties()
                .then((dgp: DynamicGlobalProperties) => {
                    blockNum = dgp.head_block_number;
                })
                .then(() => api.getWiseOperationsRelatedToDelegatorInBlock("guest123", blockNum, wise.getProtocol()))
                .then(() => blockNum++)
                .then(() => api.getWiseOperationsRelatedToDelegatorInBlock("guest123", blockNum, wise.getProtocol()))
                .then(() => blockNum++)
                .then(() => api.getWiseOperationsRelatedToDelegatorInBlock("guest123", blockNum, wise.getProtocol()))
                .then(() => {});
            });
        });

        describe("#getDynamicGlobalProperties", () => {
            it("returns dynamic global properties without error", () => {
                return api.getDynamicGlobalProperties()
                .then((dgp: DynamicGlobalProperties) => {
                    expect(dgp.head_block_number, "head_block_number").to.be.greaterThan(22484096);
                    expect(dgp.vote_power_reserve_rate, "vote_power_reserve_rate").to.be.greaterThan(0);
                    expect(new Date(dgp.time + "Z").getTime(), "time").to.be.closeTo(new Date().getTime(), 1000 * 10 /* 10 seconds */);
                });
            });
        });

        describe("#getAccountInfo", () => {
            it("returns account info without error", () => {
                return api.getAccountInfo("guest123")
                .then((info: AccountInfo) => {
                    expect(info.name, "name").to.be.equal("guest123");
                    expect(info.voting_power, "voting_power").to.be.greaterThan(0);

                    expect(info.vesting_shares, "vesting_shares").to.match(/^([0-9]+)\.([0-9]+)\ VESTS$/);
                    expect(parseFloat(info.vesting_shares.replace(" VESTS", "")), "vesting_shares")
                        .to.be.a("number").greaterThan(0.0);

                    expect(info.delegated_vesting_shares, "delegated_vesting_shares").to.match(/^([0-9]+)\.([0-9]+)\ VESTS$/);
                    expect(parseFloat(info.delegated_vesting_shares.replace(" VESTS", "")), "delegated_vesting_shares")
                        .to.be.a("number").gte(0.0);

                    expect(info.received_vesting_shares, "received_vesting_shares").to.match(/^([0-9]+)\.([0-9]+)\ VESTS$/);
                    expect(parseFloat(info.received_vesting_shares.replace(" VESTS", "")), "received_vesting_shares")
                        .to.be.a("number").gte(0.0);

                    expect(new Date(info.last_vote_time + "Z").getTime(), "last_vote_time").to.be.gte(new Date("2018-05-30T12:25:36").getTime());
                });
            });

            it("throws NotFoundException if account does not exist", (done) => {
                api.getAccountInfo("nonexistent-" + Date.now())
                .then((result) => done(new Error("Should fail on nonexistent account. Got some data instead.")))
                .catch((e: Error) => {
                    if ((e as NotFoundException).notFoundException) done();
                    else done(e);
                });
            });
        });
    }));

    describe("Temporarily test here v2 rules loading", () => {
        it("loads proper rules (v2)", () => {
            const api = new DirectBlockchainApi("guest123", "");
            const wise = new Wise("guest123", api);
            const delegator = "guest123";
            const voter = "guest123";
            const moment = new SteemOperationNumber(22806999, 38, 0);
            return api.loadRulesets(delegator, voter, moment, wise.getProtocol())
            .then(((r: SetRules) => {
                expect(r.rulesets).to.be.an("array").with.length(1);
                expect(r.rulesets[0].name).to.equal("test_purpose_ruleset");
            }));
        });
    });
});
