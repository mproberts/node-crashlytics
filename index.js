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
	this.email          = email;
	this.password       = password;
	this.developerToken = developerToken;

	return this;
};

Crashlytics.ENABLE_DEBUGGING = false;

Crashlytics.Metric = {
	Events:  'events_count',
	Issues:  'issues_count',
	Crashes: 'crashes_count',
	Users:   'impacted_devices_count'
};

Crashlytics.prototype._apiCall = function(app, slug, options, postData, callback) {
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

	if (this.organization && (typeof(options.includeOrganization) === 'undefined' || options.includeOrganization)) {
		path += '/organizations/'+this.organization
	}

	if (appDescription) {
		path += '/apps/'+appDescription.id;
	}

	path += slug;

	var headers = { 'X-CRASHLYTICS-DEVELOPER-TOKEN': this.developerToken };

	if (this.accessToken) {
		headers['X-CRASHLYTICS-ACCESS-TOKEN'] = this.accessToken;
	}

	if (postData) {
		headers['content-length'] = postData.length;
	}

	headers['accept'] = 'application/json';

	if (Crashlytics.ENABLE_DEBUGGING) {
		console.log(path);
	}

	var self = this;
	var apiRequest = https.request({
		hostname: (!!options.useWww ? 'www' : 'api') + '.crashlytics.com',
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
		self._apiCall(null, '/session.json', {}, encodeParamters({email: self.email, password: self.password}), loginRequestComplete);

		function loginRequestComplete(err, body) {
			if (err) {
				self.accessToken = null;
				callback(err);
			}
			else {
				self.accessToken = body.token;
				self.organizationAlias = body.current_organization.alias;
				self.organization = body.current_organization.id;

				self._apiCall(null, '/apps.json', {}, null, function(err, apps) {
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

	return this._apiCall(app, '/builds.json?limit=1000', {}, null, callback);
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

	if (options.build) {
		options.build_equals = options.build;
	}

	if (options.start) {
		options.created_gte = options.start;
	}

	if (options.end) {
		options.created_lte = options.end;
	} else {
		options.created_lte = ~~(+new Date()/1000);
	}

	return this._apiCall(app, '/issues.json?'+encodeParamters(options), {}, null, processResult);
};

Crashlytics.prototype.search = function(app, query, options, callback) {
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

	options.build       = options.build || 'all';
	options.start       = options.start || ~~((+new Date()/1000) - 2592000);
	options.end         = options.end || ~~(+new Date()/1000);
	options.query       = query;
	options.count       = 1000;
	options.page        = 1;

	return this._apiCall(app, '/search?'+encodeParamters(options), {
		includeOrganization: false,
		useWww: true
	}, null, processResult);
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
	options.event_type  = options.event_type || 'all';
	options.metric      = options.metric || Crashlytics.Metric.Events;
	options.start       = options.start || ~~((+new Date()/1000) - 2592000);
	options.end         = options.end || ~~(+new Date()/1000);
	options.data_points = options.data_points || ~~((options.end - options.start) / 3600);

	return this._apiCall(app, '/metrics/timeseries?'+encodeParamters(options), {}, null, processResult);
};

module.exports = Crashlytics;
