const SETTINGS_URL = 'src/options/default-settings.json';

const loadDefaultSettings = async () =>
	fetch(chrome.runtime.getURL(SETTINGS_URL))
		.then((response) =>
			response.json())
		.then((res) =>
			res);

const loadUserSettings = async (defaults) =>
	new Promise((resolve) => {
		chrome.storage.sync.get(defaults, (settings) => {
			resolve(settings);
		});
	});

const loadSettings = async () => {
	const defaults = await loadDefaultSettings();
	const userSettings = await loadUserSettings(defaults);
	return userSettings;
};

export { loadSettings };
