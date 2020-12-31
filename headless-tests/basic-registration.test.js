const faker = require('faker');
const {expect} = require("chai");

const {Future, promiseEvent, delay} = require("junk-bucket/future");
const EventEmitter = require("eventemitter3");
const WebSocket = require('ws');

const {MultiUserConferenceClient, Chat, Connection, DisconnectReasons} = require("../client/client");
const {promiseEventWithin} = require("./junk");
const {MultiUserConferenceServer} = require("../service/service");

const {tracer} = require("./test-junk");

describe("Multi-User Conference", function (){
	let span;
	beforeEach(function (){
		span = tracer.startSpan(this.test.fullTitle());
	});
	afterEach(function (){
		if (this.currentTest.state === 'failed') {
			span.setTag("error", true);
		}
		span.finish();
	});

	let muc, address;
	beforeEach(async function (){
		muc = new MultiUserConferenceServer(tracer);
		address = await muc.startInProcess();
	});
	afterEach(async function (){
		muc.end();
	});

	describe("Given a new user", function (){
		describe("When that user successfully registers", function (){
			let client, userName, secret;
			beforeEach(async function () {
				userName = faker.internet.email();
				secret = faker.internet.password();

				client = new MultiUserConferenceClient(tracer);
				await client.connect(address, span);
				await client.register(userName, secret, span);
			});
			afterEach(async  function () {
				if( client) { client.end(); }
			});

			it( "retains the user name on the client object", async function () {
				expect(client.userName).to.deep.equal(userName);
			});

			it("Then the user can whisper to themselves", async function (){
				const words = faker.random.words(5);
				const received = promiseEvent(client, Chat.Whisper);
				await client.whisper(userName, words, span);
				expect((await received).message).to.eq(words);
			});

			describe("and the user attempts to login again while still connected", () => {
				let secondClient;
				beforeEach(async function() {
					secondClient = new MultiUserConferenceClient(tracer);
					await secondClient.connect(address, span);
				});
				afterEach(async function() {
					if(secondClient){ secondClient.end(); }
				});

				describe("and a user attempts to login with incorrect credentials", () => {
					it("rejects the login attempt", async function () {
						const attempt = await secondClient.login(userName, "no"+ secret, span);
						expect(attempt.ok).to.eq(false);
					});
				});
				describe("and uses correct credentials", () => {
					it("acknowledges the correct login", async function () {
						const attempt = await secondClient.login(userName, secret, span);
						expect(attempt.ok).to.eq(true);
					});

					it("terminates the original client", async function() {
						const closeNotice = promiseEventWithin(client, Connection.Disconnected, 500);
						await secondClient.login(userName, secret, span);
						const result = await closeNotice;
						expect(result.reason).to.eq(DisconnectReasons.AnotherLocation);
					});
				});
			});

			describe("and original connection is closed", () => {
				let secondClient;
				beforeEach(async function() {
					client.end();
					client = null;

					secondClient = new MultiUserConferenceClient(tracer);
					await secondClient.connect(address, span);
				});
				afterEach(async function() {
					if(secondClient){ secondClient.end(); }
				});

				describe("and a user attempts to login with incorrect credentials", () => {
					it("rejects the login attempt", async function () {
						const result = await secondClient.login(userName, secret + "tell", span);
						expect(result.ok).to.eq(false);
					});
				});
				describe("and uses correct credentials", () => {
					it("allows login", async function() {
						const result = await secondClient.login(userName, secret, span);
						expect(result.ok).to.eq(true);
					});
				});
			});
		});
	});

	describe("Given two users", function (){
		describe("When one user whispers to another", function (){
			it("Then the receiving user gets the message", async function (){
				const message = faker.random.words(5);

				const userOneName = faker.internet.userName();
				const userOne = new MultiUserConferenceClient(tracer);
				await userOne.connect(address, span);
				try {
					await userOne.register(userOneName, faker.internet.password(), span);

					const userTwoName = faker.internet.userName();
					const userTwo = new MultiUserConferenceClient(tracer);
					try {
						await userTwo.connect(address, span);
						await userTwo.register(userTwoName, faker.internet.password(), span);
						const received = promiseEventWithin(userTwo, Chat.Whisper, 500);

						await userOne.whisper(userTwoName, message, span);
						expect((await received).message).to.eq(message);
					} finally {
						userTwo.end();
					}
				} finally {
					userOne.end();
				}
			});
		});
	});
});
