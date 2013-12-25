var https = require('https');

function encodeParamters(parameters) {
	var paramList = [];

	for (var key in parameters) {
		if (!parameters.hasOwnProperty(key)) {
			continue;
		}

		paramList.push(key + '=' + encodeURIComponent(parameters[key]));
	}

	return paramList.join('&');
};

function Crashlytics(email, password, developerToken) {
	this.email    = email;
	this.password = password;

	return this;
};

Crashlytics.prototype._apiCall = function(app, slug, postData, callback) {
	if (app) {
		var appDescription;

		for (var i = 0; i < this.apps.length; ++i) {
			if (this.apps[i].bundle_identifier === app) {
				appDescription = this.apps[i];
			}
		}

		if (!appDescription) {
			return callback('App ' + app + ' not found');
		}
	}

	var path = '/api/v2';

	if (this.organization) {
		path += '/organizations/'+this.organization
	}

	if (appDescription) {
		path += '/apps/'+appDescription.id;
	}

	path += slug;

	var headers = { 'X-CRASHLYTICS-DEVELOPER-TOKEN': Crashlytics.DEVELOPER_TOKEN };

	if (this.accessToken) {
		headers['X-CRASHLYTICS-ACCESS-TOKEN'] = this.accessToken;
	}

	if (postData) {
		headers['content-length'] = postData.length;
	}

	var self = this;
	var apiRequest = https.request({
		hostname: 'api.crashlytics.com',
		port:     443,
		path:     path,
		method:   postData ? 'POST' : 'GET',
		headers:  headers
	}, apiRequestComplete);

	apiRequest.on('error', apiError);

	if (postData) {
		apiRequest.write(postData);
	}

	apiRequest.end();

	function apiRequestComplete(result) {
		if (result.statusCode >= 200 && result.statusCode < 300) {
			var body = '';

			result.on('data', function(data) {
				body += data;
			});

			result.on('end', function(data) {
				callback(null, JSON.parse(body));
			});
		}
		else {
			callback(result.statusCode);
		}
	}

	function apiError(err) {
		callback(err);
	}
};

Crashlytics.prototype.login = function(callback) {
	var self = this;
	var sessionRequest = https.request({
		hostname: 'www.crashlytics.com',
		port:     443,
		path:     '/login',
		method:   'GET'
	}, sessionRequestComplete);

	sessionRequest.on('error', callback);
	sessionRequest.end();

	function sessionRequestComplete(result) {
		self._apiCall(null, '/session.json', encodeParamters({email: self.email, password: self.password}), loginRequestComplete);

		function loginRequestComplete(err, body) {
			if (err) {
				self.accessToken = null;
				callback(err);
			}
			else {
				self.accessToken = body.token;
				self.organizationAlias = body.current_organization.alias;
				self.organization = body.current_organization.id;

				self._apiCall(null, '/apps.json', null, function(err, apps) {
					self.apps = apps;

					callback(null, self);
				});
			}
		}
	}
};

Crashlytics.prototype.builds = function(app, callback) {
	if (!this.accessToken) {
		return callback('Must be logged in');
	}

	callback = callback || function() {};

	return this._apiCall(app, '/builds.json?limit=1000', null, callback);
};

Crashlytics.prototype.issues = function(app, options, callback) {
	if (!this.accessToken) {
		return callback('Must be logged in');
	}

	if (!callback && typeof(options) === 'function') {
		callback = options;
		options = null;
	}

	if (!app) {
		return callback('No app specified');
	}

	options = options || {};
	callback = callback || function() {};

	function processResult(err, issues) {
		return callback(err, issues);
	}

	options.status_equals = options.status || 'all';
	options.event_type    = options.event_type || 'all';

	return this._apiCall(app, '/issues.json?'+encodeParamters(options), null, processResult);
};

Crashlytics.prototype.events = function(app, options, callback) {
	if (!this.accessToken) {
		return callback('Must be logged in');
	}

	if (!callback && typeof(options) === 'function') {
		callback = options;
		options = null;
	}

	if (!app) {
		return callback('No app specified');
	}

	options = options || {};
	callback = callback || function() {};

	function processResult(err, timeseries) {
		var series;

		if (timeseries) {
			series = timeseries.series;
		}

		return callback(err, series);
	}

	options.build       = options.build || 'all';
	options.status      = options.status || 'all';
	options.event_type  = options.event_type || 'all';
	options.metric      = 'events_count';
	options.start       = options.start || ~~((+new Date()/1000) - 2592000);
	options.end         = options.end || ~~(+new Date()/1000);
	options.data_points = options.data_points || ~~((options.end - options.start) / 3600);

	return this._apiCall(app, '/metrics/timeseries.json?'+encodeParamters(options), null, processResult);
};

module.exports = Crashlytics;
