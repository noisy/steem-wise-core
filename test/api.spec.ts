import { assert, expect } from "chai";
import { Promise } from "bluebird";
import "mocha";

import { Api } from "../src/api/Api";
import { DirectBlockchainApi } from "../src/api/DirectBlockchainApi";
import { WiseRESTApi } from "../src/api/WiseRESTApi";
import { SteemPost } from "../src/blockchain/SteemPost";

describe("test/api.spec.ts", function () {
    this.timeout(10000);

    const username = "steemprojects1";
    const postingWif = "";

    [
        new DirectBlockchainApi(username, postingWif),
        new WiseRESTApi(username, postingWif)
    ]
    .forEach((api: Api) => describe("api " + api.name(), () => {
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

            it("fails on nonexistent post", (done) => {
                api.loadPost("noisy", "nonexistent-permlink-" + new Date())
                    .then((result) => done(new Error("Should fail on nonexistent post. Got some data instead.")), () => done());
            });
        });

        describe("#loadRulesets", () => {
            it.skip("TODO write tests", () => {});
        });
        describe("#streamSince", () => {
            it.skip("TODO write tests", () => {});
        });
        describe("#sendToBlockchain", () => {
            it.skip("TODO write tests", () => {});
        });
    }));
});