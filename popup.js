let currentProfile = null;

function loadProfileList() {
    chrome.storage.local.get(['profiles'], function(result) {
        const profiles = result.profiles || {};
        const select = document.getElementById('profileSelect');
        select.innerHTML = '<option value="">Select a profile</option>';
        for (let profileName in profiles) {
            const option = document.createElement('option');
            option.value = profileName;
            option.textContent = profileName;
            select.appendChild(option);
        }
        console.log('Profiles loaded:', profiles);
    });
}

function displayProfileDetails(profile) {
    const detailsDiv = document.getElementById('profileDetails');
    if (profile) {
        detailsDiv.innerHTML = `
            <h3>${profile.name}</h3>
            <p>Email: ${profile.email || 'N/A'}</p>
            <p>Phone: ${profile.phone || 'N/A'}</p>
            <p>Name: ${profile.firstName || ''} ${profile.lastName || ''}</p>
            <p>Address: ${profile.address || ''}, ${profile.city || ''}, ${profile.zip || ''}</p>
        `;
        detailsDiv.style.display = 'block';
    } else {
        detailsDiv.style.display = 'none';
    }
}


function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section.style.display === 'none' || section.style.display === '') {
        section.style.display = 'block';
    } else {
        section.style.display = 'none';
    }
}

function updateSavedDataPreview() {
    chrome.storage.local.get(['trainingData', 'lastUsedValues'], function(result) {
        const previewDiv = document.getElementById('savedDataPreview');
        previewDiv.innerHTML = '<h3>Saved Data:</h3>';
        
        const savedData = {...result.lastUsedValues, ...result.trainingData};
        
        if (Object.keys(savedData).length > 0) {
            for (let fieldName in savedData) {
                const fieldValue = Array.isArray(savedData[fieldName]) ? savedData[fieldName].join(', ') : savedData[fieldName];
                const fieldDiv = document.createElement('div');
                fieldDiv.innerHTML = `<strong>${fieldName}:</strong> ${fieldValue} <button class="copyBtn" data-field="${fieldName}">Copy</button>`;
                previewDiv.appendChild(fieldDiv);
            }

            // Add event listeners for copy buttons
            document.querySelectorAll('.copyBtn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const fieldName = this.getAttribute('data-field');
                    const fieldValue = Array.isArray(savedData[fieldName]) ? savedData[fieldName][savedData[fieldName].length - 1] : savedData[fieldName];
                    navigator.clipboard.writeText(fieldValue).then(() => {
                        alert('Copied to clipboard!');
                    });
                });
            });
        } else {
            previewDiv.innerHTML += '<p>No saved data available</p>';
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    loadProfileList();
    updateSavedDataPreview();

    document.getElementById('profileSelect').addEventListener('change', function() {
        const profileName = this.value;
        if (profileName) {
            chrome.storage.local.get(['profiles'], function(result) {
                const profiles = result.profiles || {};
                currentProfile = profiles[profileName];
                console.log('Retrieved profile:', currentProfile);
                displayProfileDetails(currentProfile);
            });
        } else {
            currentProfile = null;
            displayProfileDetails(null);
        }
    });

    document.getElementById('applyProfile').addEventListener('click', function() {
        if (currentProfile) {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                chrome.tabs.sendMessage(tabs[0].id, {action: 'fillForm', profile: currentProfile}, function(response) {
                    console.log('Response from content script:', response);

                    if (chrome.runtime.lastError) {
                        alert('Error applying profile');
                    } else {
                        alert('Profile applied successfully');
                    }
                });
            });
        } else {
            alert('Please select a profile first');
        }
    });

    document.getElementById('advancedSettingsToggle').addEventListener('click', function() {
        const advancedSettings = document.getElementById('advancedSettings');
        if (advancedSettings.style.display === 'none' || advancedSettings.style.display === '') {
            advancedSettings.style.display = 'block';
        } else {
            advancedSettings.style.display = 'none';
        }
    });

    document.getElementById('createProfile').addEventListener('click', function() {
        toggleSection('profileForm');
        document.getElementById('profileName').value = '';
        document.getElementById('emailInput').value = '';
        document.getElementById('phoneInput').value = '';
        document.getElementById('firstNameInput').value = '';
        document.getElementById('lastNameInput').value = '';
        document.getElementById('addressInput').value = '';
        document.getElementById('cityInput').value = '';
        document.getElementById('zipInput').value = '';
        resetErrorMessages(); // Resetujemy błędy przy otwieraniu formularza
    });

    document.getElementById('saveProfile').addEventListener('click', function() {
        const profileName = document.getElementById('profileName').value;
        if (!profileName) {
            alert('Please enter a profile name');
            return;
        }

        const newProfile = {
            name: profileName,
            email: document.getElementById('emailInput').value,
            phone: document.getElementById('phoneInput').value,
            firstName: document.getElementById('firstNameInput').value,
            lastName: document.getElementById('lastNameInput').value,
            address: document.getElementById('addressInput').value,
            city: document.getElementById('cityInput').value,
            zip: document.getElementById('zipInput').value
        };

        chrome.runtime.sendMessage({action: 'saveProfile', profile: newProfile}, function(response) {
            if (chrome.runtime.lastError) {
                console.error('Error saving profile:', chrome.runtime.lastError);
                alert('Error saving profile');
            } else if (response && response.status === 'Profile saved') {
                alert('Profile saved successfully');
                loadProfileList();
                toggleSection('profileForm');
                // Clear the form
                var formElement = document.getElementById('profileForm');
                if (formElement && formElement.tagName === 'FORM') {
                    formElement.reset();
                }
            } else {
                alert('Error saving profile');
            }
        });
    });

    document.getElementById('deleteProfile').addEventListener('click', function() {
        if (currentProfile) {
            chrome.storage.local.get(['profiles'], function(result) {
                let profiles = result.profiles || {};
                if (profiles[currentProfile.name]) {
                    delete profiles[currentProfile.name];
                    chrome.storage.local.set({profiles: profiles}, function() {
                        if (chrome.runtime.lastError) {
                            console.error('Error deleting profile:', chrome.runtime.lastError);
                            alert('Error deleting profile');
                        } else {
                            alert('Profile deleted successfully');
                            currentProfile = null;
                            loadProfileList();
                            displayProfileDetails(null);
                        }
                    });
                } else {
                    alert('Profile not found');
                }
            });
        } else {
            alert('Please select a profile to delete');
        }
    });

    document.getElementById('showSuggestions').addEventListener('click', function() {
        // Pobieranie danych z chrome.storage.local
        chrome.storage.local.get(['markovChains', 'trainingData'], function(result) {
            const suggestionsContainer = document.getElementById('suggestionsContainer');
            suggestionsContainer.innerHTML = '<h3>Suggestions:</h3>';
            const trainingData = result.trainingData || {};
            const markovChains = result.markovChains || {};

            if (Object.keys(trainingData).length === 0) {
                suggestionsContainer.innerHTML += '<p>No suggestions available</p>';
                return;
            }

            for (let fieldType in trainingData) {
                const valueCount = {};

                // Jeśli istnieją dane w markovChains, używamy ich
                if (markovChains[fieldType]) {
                    for (let currentValue in markovChains[fieldType]) {
                        for (let nextValue in markovChains[fieldType][currentValue]) {
                            if (valueCount[nextValue]) {
                                valueCount[nextValue] += markovChains[fieldType][currentValue][nextValue];
                            } else {
                                valueCount[nextValue] = markovChains[fieldType][currentValue][nextValue];
                            }
                        }
                    }
                }

                // Dodajemy brakujące wartości z trainingData (jeśli jakiekolwiek)
                trainingData[fieldType].forEach(value => {
                    if (!valueCount[value]) {
                        valueCount[value] = 1;
                    }
                });

                // Sortowanie wartości według częstości występowania (malejąco)
                const sortedValues = Object.keys(valueCount).sort((a, b) => valueCount[b] - valueCount[a]);

                // Pobieranie maksymalnie 5 najczęściej używanych wartości
                const topSuggestions = sortedValues.slice(0, 5);

                if (topSuggestions.length > 0) {
                    const fieldDiv = document.createElement('div');
                    fieldDiv.innerHTML = `<strong>${fieldType}:</strong> ${topSuggestions.join(', ')}`;
                    suggestionsContainer.appendChild(fieldDiv);
                }
            }

            if (suggestionsContainer.innerHTML === '<h3>Suggestions:</h3>') {
                suggestionsContainer.innerHTML += '<p>No suggestions available</p>';
            }
        });
        toggleSection('suggestionsContainer');
    });

    document.getElementById('showModelData').addEventListener('click', function() {
        chrome.storage.local.get(['trainingData', 'markovChains', 'crossFieldChains'], function(result) {
            const modelDataContainer = document.getElementById('modelDataContainer');
            modelDataContainer.innerHTML = '<h3>Model Data:</h3>';

            if (!result.trainingData && !result.markovChains && !result.crossFieldChains) {
                modelDataContainer.innerHTML += '<p>No model data available</p>';
                return;
            }

            const modelData = {
                trainingData: result.trainingData || {},
                markovChains: result.markovChains || {},
                crossFieldChains: result.crossFieldChains || {}
            };

            const pre = document.createElement('pre');
            pre.textContent = JSON.stringify(modelData, null, 2);
            modelDataContainer.appendChild(pre);

            toggleSection('modelDataContainer');
        });
    });

    document.getElementById('exportProfiles').addEventListener('click', function() {
        chrome.runtime.sendMessage({action: 'loadProfiles'}, function(response) {
            if (chrome.runtime.lastError) {
                console.error('Error loading profiles:', chrome.runtime.lastError.message || chrome.runtime.lastError);
                alert('Error loading profiles: ' + (chrome.runtime.lastError.message || chrome.runtime.lastError));
                return;
            }

            const profiles = response.profiles;
            if (!profiles) {
                alert('No profiles to export.');
                return;
            }

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(profiles));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", "form_filler_profiles.json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });
    });

    document.getElementById('importProfiles').addEventListener('click', function() {
        document.getElementById('importFile').click();
    });

    document.getElementById('importFile').addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const importedProfiles = JSON.parse(e.target.result);

                    // Sprawdź, czy importowane profile mają odpowiednią strukturę
                    for (let profileName in importedProfiles) {
                        const profile = importedProfiles[profileName];
                        if (!profile.name || !profile.email || !profile.firstName || !profile.lastName || !profile.address || !profile.city || !profile.zip) {
                            alert(`Profile ${profileName} is missing some data. Please check the structure.`);
                            return;
                        }
                    }

                    chrome.storage.local.get(['profiles'], function(result) {
                        const currentProfiles = result.profiles || {};
                        const mergedProfiles = {...currentProfiles, ...importedProfiles};

                        chrome.storage.local.set({profiles: mergedProfiles}, function() {
                            if (chrome.runtime.lastError) {
                                console.error('Error saving imported profiles:', chrome.runtime.lastError.message);
                                alert('Error importing profiles');
                            } else {
                                alert('Profiles imported successfully');
                                loadProfileList();
                            }
                        });
                    });
                } catch (error) {
                    alert('Error importing profiles: ' + error.message);
                }
            };
            reader.readAsText(file);
        }
    });
});
