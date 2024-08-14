let trainingData = {};

chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});

chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.sendMessage(tab.id, {action: "togglePopup"});
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message in background:', request);

    if (request.action === 'trainModel') {
        chrome.storage.local.get(['trainingData', 'markovChains'], (result) => {
            let trainingData = result.trainingData || {};
            let markovChains = result.markovChains || {};

            const { fieldName, fieldValue } = request;
            if (!trainingData[fieldName]) {
                trainingData[fieldName] = [];
            }
            trainingData[fieldName].push(fieldValue);
            trainingData[fieldName] = trainingData[fieldName].slice(-20); // Keep last 20 entries

            // Update markovChains
            if (!markovChains[fieldName]) {
                markovChains[fieldName] = {};
            }
            const data = trainingData[fieldName];
            for (let i = 0; i < data.length - 1; i++) {
                const current = data[i];
                const next = data[i + 1];
                if (!markovChains[fieldName][current]) {
                    markovChains[fieldName][current] = {};
                }
                if (!markovChains[fieldName][current][next]) {
                    markovChains[fieldName][current][next] = 0;
                }
                markovChains[fieldName][current][next]++;
            }

            // Save both trainingData and markovChains to local storage
            chrome.storage.local.set({trainingData, markovChains}, () => {
                console.log('Training data saved:', trainingData);
                console.log('Markov chains saved:', markovChains);
                if (chrome.runtime.lastError) {
                    console.error('Error saving data:', chrome.runtime.lastError);
                } else {
                    console.log('Training data and Markov chains saved to local storage');
                    sendResponse({status: 'Data updated'});
                }
            });
        });

        return true;
    }

    if (request.action === 'saveProfile') {
        chrome.storage.local.get(['profiles'], (result) => {
            let profiles = result.profiles || {};
            profiles[request.profile.name] = request.profile;
            chrome.storage.local.set({profiles: profiles}, () => {
                console.log('Profiles after saving:', profiles);
                sendResponse({status: 'Profile saved'});
            });
        });
        return true;
    }
    
    
    if (request.action === 'loadProfiles') {
        chrome.storage.local.get(['profiles'], (result) => {
            if (chrome.runtime.lastError) {
                sendResponse({error: chrome.runtime.lastError.message});
            } else {
                sendResponse({profiles: result.profiles || {}});
            }
        });
        return true;
    }
    
});