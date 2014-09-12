# Usage

```
var Crashlytics = require('crashlytics');
var api = new Crashlytics(
	'someone@company.ca',   // email of the account you're logging into
	'superSECURE_pa$$w0rd', // password for that same account
	'0123456789abcdef01...' // developer token (see below)
);

// set up your session
api.login(function(err, api) {
	if (!err) {
		var now = ~~(+new Date()/1000);
		var options = {
			end   : now,
			start : now - 2592000
		};

		// get the last 30 days worth of error events for your awesome app
		api.events('ca.company.awesomeapp', options, function(err, events) {
			// do something useful with your event counts!
			processMetricsEvents(events);
		});
	}
});
```

## Methods

* `crashlytics.builds(app, callback)`

  Gets the list of all builds known to Crashlytics and the associated info.

* `crashlytics.issues(app, [options], callback)`

  Gets a list of according to the supplied options.

* `crashlytics.events(app, [options], callback)`

  Gets a list of timestamped event counts for all error events (useful for graphing).

## Developer Tokens

The developer token supplied as the 3rd argument to the constructor can be retrieved
from the Crashlytics web app. If you snoop on your web traffic (the Chrome debugger's 
network tab is very useful for this) you will see the `X-CRASHLYTICS-DEVELOPER-TOKEN` 
header being sent after you have logged in. This will be a 160-bit hex number. Just copy
this and use it in your code.
