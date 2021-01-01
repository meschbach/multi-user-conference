/**
 * Reasons for disconnecting
 * @type {{Login: symbol, NotAuthenticated: symbol}}
 */
const Disconnect = {
	/**
	 * User logged in from a different browser or location
	 */
	Login: Symbol("login"),
	/**
	 * Client attempted to perform an action which requires an authenticated user
	 */
	NotAuthenticated: Symbol("not-authenticated")
}

module.exports = {
	Disconnect
}
