let trainingData = {};

importScripts('crypto.js');

chrome.runtime.onInstalled.addListener(async () => {
    console.log('Extension installed');

    const key = await getKey();
    if (!key) {
        //Jesli klucz nie istnieje to stworz nowy
        const newKey = await generateKey();
        await storeKey(newKey);
        console.log('Encryption key generated and stored.');
    } else {
        console.log('Encryption key already exists.');
    }
});

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.sendMessage(tab.id, {action: "togglePopup"});
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message in background:', request);

    if (request.action === 'trainModel') {
        (async () => {
            try {
                const result = await retrieveDecryptedData('trainingData');
                let trainingData = result?.trainingData || {};
                let wordCounts = result?.wordCounts || {};
                const { fieldName, fieldValue } = request;

                if (!trainingData[fieldName]) {
                    trainingData[fieldName] = [];
                }
                trainingData[fieldName].push(fieldValue);
                trainingData[fieldName] = trainingData[fieldName].slice(-20);

                if (!wordCounts[fieldName]) {
                    wordCounts[fieldName] = {};
                }

                const latestEntry = fieldValue;
                if (!wordCounts[fieldName][latestEntry]) {
                    wordCounts[fieldName][latestEntry] = 0;
                }
                wordCounts[fieldName][latestEntry]++;

                await storeEncryptedData('trainingData', { trainingData, wordCounts });

                sendResponse({ status: 'Data updated' });
            } catch (error) {
                console.error('Error training model:', error);
                sendResponse({ status: 'Error', message: error.message || 'Unknown error' });
            }
        })();
        return true;
    }

    if (request.action === 'saveProfile') {
        (async () => {
            try {
                const profiles = await retrieveDecryptedData('profiles') || {};
                profiles[request.profile.name] = request.profile;
                await storeEncryptedData('profiles', profiles);
                sendResponse({ status: 'Profile saved' });
            } catch (error) {
                console.error('Error saving profile:', error);
                sendResponse({ status: 'Error', message: error.message || 'Unknown error' });
            }
        })();
        return true;
    }

    if (request.action === 'loadProfiles') {
        (async () => {
            try {
                const profiles = await retrieveDecryptedData('profiles');
                sendResponse({ profiles });
            } catch (error) {
                console.error('Error loading profiles:', error);
                sendResponse({ status: 'Error', message: error.message || 'Unknown error' });
            }
        })();
        return true;
    }
    return true;
});
