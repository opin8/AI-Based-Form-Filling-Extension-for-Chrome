class FormFillerModel {
    constructor() {
        this.trainingData = {};
        this.wordCounts = {};
        this.crossFieldChains = {};
        this.minOccurrencesForSuggestion = 2;
        this.loadTrainingData();
    }

    async loadTrainingData() {
        const trainingData = await retrieveDecryptedData('trainingData');
        this.trainingData = trainingData?.trainingData || {};
        this.wordCounts = trainingData?.wordCounts || {};
        this.crossFieldChains = trainingData?.crossFieldChains || {};
    }

    async updateModel(fieldName, fieldValue) {
        if (fieldValue.length <= 2) return;

        switch (fieldName) {
            case 'phone':
                if (!validatePhoneNumber(fieldValue)) return;
                break;
            case 'email':
                if (!validateEmail(fieldValue)) return;
                break;
            case 'firstName':
                if (!validateFirstName(fieldValue)) return;
                break;
            case 'lastName':
                if (!validateLastName(fieldValue)) return;
                break;
            case 'zipCode':
                if (!validateZipCode(fieldValue)) return;
                break;
            case 'address':
                if (!validateAddress(fieldValue)) return;
                break;
            case 'city':
                if (!validateCity(fieldValue)) return;
                break;
        }

        if (!this.trainingData[fieldName]) {
            this.trainingData[fieldName] = [];
        }
        this.trainingData[fieldName].push(fieldValue);
        this.trainingData[fieldName] = this.trainingData[fieldName].slice(-20);
    
        this.updateWordCounts(fieldName);
        this.updateCrossFieldChains(fieldName, fieldValue);
    
        await this.saveTrainingData();
        console.log('Data saved successfully');

    }

    async saveTrainingData() {
        // Pobierz istniejące dane
        const existingData = await retrieveDecryptedData('trainingData') || {};
    
        // Połącz istniejące dane z nowymi
        const data = {
            trainingData: {
                ...existingData.trainingData,
                ...this.trainingData
            },
            wordCounts: {
                ...existingData.wordCounts,
                ...this.wordCounts
            },
            crossFieldChains: {
                ...existingData.crossFieldChains,
                ...this.crossFieldChains
            }
        };
        await storeEncryptedData('trainingData', data);
    }

    updateWordCounts(fieldName) {
    const data = this.trainingData[fieldName];
    if (!this.wordCounts[fieldName]) {
        this.wordCounts[fieldName] = {};
    }

    // Iteruj po ostatnim dodanym elemencie, aby dodać tylko jeden do licznika
    const latestEntry = data[data.length - 1];  // Ostatni dodany element
    if (!this.wordCounts[fieldName][latestEntry]) {
        this.wordCounts[fieldName][latestEntry] = 0;
    }
    this.wordCounts[fieldName][latestEntry]++;
}

    

    updateCrossFieldChains(fieldName, fieldValue) {
        const relevantFields = ['firstName', 'lastName', 'email', 'phone', 'city'];
    
        relevantFields.forEach(relevantField => {
            if (relevantField === fieldName) return;
    
            const relatedValue = this.trainingData[relevantField] ? this.trainingData[relevantField][this.trainingData[relevantField].length - 1] : null;
            if (relatedValue) {
                if (!this.crossFieldChains[fieldName]) {
                    this.crossFieldChains[fieldName] = {};
                }
                if (!this.crossFieldChains[fieldName][relatedValue]) {
                    this.crossFieldChains[fieldName][relatedValue] = {};
                }
                if (!this.crossFieldChains[fieldName][relatedValue][fieldValue]) {
                    this.crossFieldChains[fieldName][relatedValue][fieldValue] = 0;
                }
                this.crossFieldChains[fieldName][relatedValue][fieldValue]++;
    
                // Limitowanie liczby powiązań do 20 ostatnich
                const keys = Object.keys(this.crossFieldChains[fieldName][relatedValue]);
                if (keys.length > 20) {
                    keys.slice(0, keys.length - 20).forEach(key => {
                        delete this.crossFieldChains[fieldName][relatedValue][key];
                    });
                }
            }
        });
    }
    

    generateSuggestions(fieldType, currentFormData = {}) {
        let suggestions = [];
        const occurrenceMap = {};
    
        // Jeśli istnieją dane w crossFieldChains, użyj ich do generowania sugestii
        for (const [previousFieldType, previousValue] of Object.entries(currentFormData)) {
            if (this.crossFieldChains[fieldType] && this.crossFieldChains[fieldType][previousValue]) {
                const possibleNext = this.crossFieldChains[fieldType][previousValue];
                for (const suggestion in possibleNext) {
                    const count = possibleNext[suggestion];
                    occurrenceMap[suggestion] = (occurrenceMap[suggestion] || 0) + count;
                }
            }
        }
    
        // Generowanie sugestii na podstawie crossFieldChains
        suggestions = Object.keys(occurrenceMap).sort((a, b) => occurrenceMap[b] - occurrenceMap[a]);
    
        // Jeśli mniej niż 3 sugestie, uzupełnij najczęściej występującymi słowami z trainingData
        if (suggestions.length < 3) {
            const remainingSuggestions = 3 - suggestions.length;
            const trainingSuggestions = this.getMostFrequentValues(fieldType, remainingSuggestions, suggestions);
            suggestions = suggestions.concat(trainingSuggestions);
        }
    
        return suggestions.slice(0, 3);  // Zwróć maksymalnie 3 sugestii
    }
    
    
    getMostFrequentValues(fieldType, limit, excludeValues = []) {
        const occurrenceMap = {};
    
        if (this.wordCounts[fieldType]) {
            for (let value in this.wordCounts[fieldType]) {
                if (!excludeValues.includes(value)) {
                    occurrenceMap[value] = this.wordCounts[fieldType][value];
                }
            }
        }
    
        return Object.keys(occurrenceMap)
            .sort((a, b) => occurrenceMap[b] - occurrenceMap[a])
            .slice(0, limit);
    }
    
    
    
    

    generateCrossFieldSuggestions(fieldName, relatedFieldValue) {
        const crossFieldSuggestions = [];
        if (this.crossFieldChains[fieldName] && this.crossFieldChains[fieldName][relatedFieldValue]) {
            const possibleNext = this.crossFieldChains[fieldName][relatedFieldValue];
            crossFieldSuggestions.push(...Object.keys(possibleNext).sort((a, b) => possibleNext[b] - possibleNext[a]).slice(0, 3));
        }
        return crossFieldSuggestions;
    }

    getAllSuggestions() {
        const allSuggestions = {};
        for (let fieldType in this.trainingData) {
            let uniqueValues = new Set(this.trainingData[fieldType]);
            allSuggestions[fieldType] = uniqueValues;
        }
        return allSuggestions;
    }
}

const formFillerModel = new FormFillerModel();

const fuzzyPatterns = {
    email: ['email', 'mail', 'e-mail', 'username', 'user_name', 'user-name'],
    firstName: ['firstname', 'fname', 'givenname', 'imie', 'first_name', 'first-name', 'name'],
    lastName: ['lastname', 'surname', 'lname', 'nazwisko', 'last_name', 'last-name'],
    address: ['address', 'adres', 'addr', 'street', 'ulica'],
    phone: ['phone', 'tel', 'telefon', 'mobile', 'cellphone', 'number', 'numer', 'phonenumber'],
    city: ['city', 'miasto', 'town', 'locality'],
    zip: ['zip', 'postal', 'postcode', 'kod', 'pocztowy']
};

const fuzzySets = {};
for (let [type, patterns] of Object.entries(fuzzyPatterns)) {
    fuzzySets[type] = FuzzySet(patterns);
}

function splitIdentifier(identifier) {
    // Podział na podstawie znaków specjalnych
    return identifier.split(/[\$_\-\.:\s\/\\\[\]#@]+/).filter(Boolean);
}

function splitCamelCase(part) {
    return part.split(/(?=[A-Z])/).filter(Boolean);
}

function getFieldTypeWithFuzzyMatching(element) {
    const autocompleteValue = element.getAttribute('autocomplete') || '';

    const nameParts = splitIdentifier(element.name || '');
    const idParts = splitIdentifier(element.id || '');
    const classNameParts = splitIdentifier(element.className || '');
    const dataTestParts = splitIdentifier(element.getAttribute('data-test') || '');
    const automationIdParts = splitIdentifier(element.getAttribute('data-automation-id') || '');
    const autocompleteParts = splitIdentifier(element.getAttribute('autocomplete') || '');

    const allParts = [...nameParts, ...idParts, ...classNameParts, ...dataTestParts, ...automationIdParts, ...autocompleteParts];

    if (autocompleteValue) {
        allParts.push(autocompleteValue);
    }

    console.log('All parts to check:', allParts);

    if (element.type === 'email') return 'email';
    if (element.type === 'tel') return 'phone';

    let bestMatch = null;
    let highestScore = 0;

    // Faza 1: Sprawdzanie połączonych sekcji (np. "last-name-input")
    for (let i = 0; i < allParts.length; i++) {
        for (let j = i + 1; j <= allParts.length; j++) {
            let combinedPart = allParts.slice(i, j).join('');
            matchAndUpdate(combinedPart);
            if (highestScore === 1) return bestMatch;
        }
    }
    // Faza 2: Sprawdzanie całych sekcji
    for (let part of allParts) {
        matchAndUpdate(part);
        if (highestScore === 1) return bestMatch;
    }
    // Faza 3: Podział camelCase, jeśli nie ma wyniku o wartości 1
    for (let part of allParts) {
        let camelCaseParts = splitCamelCase(part);
        camelCaseParts.forEach(camelPart => {
            matchAndUpdate(camelPart);
        });
    }

    function matchAndUpdate(part) {
        if (highestScore === 1) {
            return; // Jeśli już mamy wynik 1, nie wykonuj dalszych sprawdzeń ani wyświetlania.
        }
        for (let [fieldType, fuzzySet] of Object.entries(fuzzySets)) {
            const results = fuzzySet.get(part);
            if (results) {
                const [score, match] = results[0];
                console.log(`Part: "${part}" matched as "${fieldType}" with score: ${score}`);

                if (score > highestScore || (score === highestScore && part.length > (bestMatch?.length || 0))) {
                    highestScore = score;
                    bestMatch = fieldType;
                }

                if (score === 1) return;
            }
        }
    }

    if (highestScore > 0.7) return bestMatch;

    // Heurystyka dla autocomplete
    if (autocompleteParts.includes('email') || automationIdParts.includes('email')) {
        return 'email';
    }
    if (highestScore > 0.3 && allParts.some(part => part.includes('email'))) {
        return 'email';
    }
    if (highestScore > 0.3 && allParts.some(part => part.includes('phone'))) {
        return 'phone';
    }

    return null;
}






async function handleInputBlur(event) {
    const target = event.target;
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;

    console.log('Blur event on element:', target.name, target.id, target.className);

    const fieldType = getFieldTypeWithFuzzyMatching(target);
    console.log('Field type detected:', fieldType, 'for element:', target.name, target.id);

    if (!fieldType) {
        console.log('Unrecognized field type for element:', target.name, target.id, target.className);
        return;
    }

    const fieldValue = target.value.trim();
    if (fieldValue.length > 2) {
        console.log('Updating model for field type:', fieldType, 'with value:', fieldValue);
        formFillerModel.updateModel(fieldType, fieldValue);

        const lastUsedValues = await retrieveDecryptedData('lastUsedValues') || {};
        lastUsedValues[fieldType] = fieldValue;
        await storeEncryptedData('lastUsedValues', lastUsedValues);
        console.log('Saved to lastUsedValues:', fieldType, fieldValue);
    }
}


function handleInputFocus(event) {
    const target = event.target;
    const fieldType = getFieldTypeWithFuzzyMatching(target);
    if (!fieldType) return;

    const suggestionBox = showSuggestions(target, fieldType);

    if (suggestionBox) {
        target.addEventListener('blur', function blurHandler(e) {
            //male opoznienie aby moc kliknac na sugestie
            setTimeout(() => {
                if (suggestionBox && suggestionBox.parentNode) {
                    suggestionBox.remove();
                }
                target.removeEventListener('blur', blurHandler);
            }, 200);
        });

        document.addEventListener('click', function clickHandler(e) {
            if (!suggestionBox.contains(e.target) && e.target !== target) {
                suggestionBox.remove();
                document.removeEventListener('click', clickHandler);
            }
        });
    }
}


function showSuggestions(target, fieldType) {
    let suggestionBox = target.nextSibling;
    if (suggestionBox && suggestionBox.className === 'suggestion-box') {
        suggestionBox.remove();
    }

    if (!isFieldFillable(target)) {
        return null;
    }

    suggestionBox = document.createElement('div');
    suggestionBox.className = 'suggestion-box';
    suggestionBox.style.position = 'absolute';
    suggestionBox.style.border = '1px solid black';
    suggestionBox.style.backgroundColor = '#fff';
    suggestionBox.style.zIndex = '1000';
    suggestionBox.style.padding = '0';
    suggestionBox.style.left = `${target.getBoundingClientRect().left}px`;
    suggestionBox.style.top = `${target.getBoundingClientRect().bottom + window.scrollY + 2}px`; // 2px odstępu poniżej pola

    formFillerModel.loadTrainingData().then(() => {
        const suggestions = formFillerModel.generateSuggestions(fieldType);

        if (suggestions.length === 0) {
            suggestionBox.remove(); // Usuń box jeśli brak sugestii
            return;
        } else {
            suggestions.forEach((suggestion, index) => {
                const suggestionItem = document.createElement('div');
                suggestionItem.textContent = suggestion;
                suggestionItem.style.padding = '2px';
                suggestionItem.style.cursor = 'pointer';
                suggestionItem.style.borderBottom = '1px solid black';

                if (index === suggestions.length - 1) {
                    suggestionItem.style.borderBottom = 'none';
                }

                suggestionItem.addEventListener('click', function() {
                    target.value = suggestion;
                    suggestionBox.remove();
                    target.dispatchEvent(new Event('input', { bubbles: true }));
                    target.dispatchEvent(new Event('change', { bubbles: true }));
                });

                suggestionBox.appendChild(suggestionItem);
            });
        }

        // Ustawienie szerokości boxa na szerokość pola tekstowego
        suggestionBox.style.width = `${target.offsetWidth}px`;
        document.body.appendChild(suggestionBox);
    });

    return suggestionBox;
}

function isFieldFillable(element) {
    if (element.tagName === 'INPUT') {
        const excludedTypes = ['submit', 'reset', 'button', 'image', 'file', 'hidden', 'radio', 'checkbox'];
        return !excludedTypes.includes(element.type.toLowerCase());
    }
    return element.tagName === 'TEXTAREA' || element.tagName === 'SELECT';
}

document.addEventListener('blur', handleInputBlur, true);
document.addEventListener('focus', handleInputFocus, true);

formFillerModel.loadTrainingData().then(async () => {
    const lastUsedValues = await retrieveDecryptedData('lastUsedValues') || {};
    for (let fieldName in lastUsedValues) {
        const input = document.querySelector(`input[name="${fieldName}"], input[id="${fieldName}"]`);
        if (input) {
            input.value = lastUsedValues[fieldName];
        }
    }
});

chrome.runtime.onMessage.addListener(async function(request, sender, sendResponse) {
    console.log('Received message in content script:', request);

    if (request.action === 'fillForm') {
        console.log('Received profile in content script:', request.profile);
        fillForm(request.profile);
        sendResponse({status: 'Form filled successfully'});

    } else if (request.action === 'togglePopup') {
        togglePopup();
    } else if (request.action === 'showSuggestions') {
        formFillerModel.loadTrainingData().then(() => {
            const allSuggestions = formFillerModel.getAllSuggestions();
            sendResponse({suggestions: allSuggestions});
        });
        return true;
    }
    
     else if (request.action === 'getAllSuggestions') {
        formFillerModel.loadTrainingData().then(() => {
            const allSuggestions = formFillerModel.getAllSuggestions();
            sendResponse({suggestions: allSuggestions});
        });
        return true;
    } else if (request.action === 'getSavedData') {
        const result = await retrieveDecryptedData('lastUsedValues') || {};
        sendResponse({ savedData: result });
        return true;
    } else if (request.action === 'getModelData') {
        try {
            const response = {
                modelData: {
                    trainingData: formFillerModel.trainingData,
                    wordCounts: formFillerModel.wordCounts,
                    crossFieldChains: formFillerModel.crossFieldChains
                }
            };
            sendResponse(response);
        } catch (error) {
            console.error('Error in getModelData:', error);
            sendResponse({ error: 'Failed to retrieve model data' });
        }
        return true;
    }
    return true;
});

function fillForm(profile) {
    const inputs = document.querySelectorAll('input, textarea, select');

    inputs.forEach(input => {
        const fieldType = getFieldTypeWithFuzzyMatching(input);
        if (fieldType && profile[fieldType]) {
            input.value = profile[fieldType];
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}

let popupVisible = false;

function togglePopup() {
    if (popupVisible) {
        const existingPopup = document.getElementById('formfiller-popup');
        if (existingPopup) {
            existingPopup.remove();
        }
        popupVisible = false;
    } else {
        const popup = document.createElement('div');
        popup.id = 'formfiller-popup';
        popup.style.position = 'fixed';
        popup.style.top = '20px';
        popup.style.right = '20px';
        popup.style.backgroundColor = 'white';
        popup.style.border = '1px solid black';
        popup.style.padding = '10px';
        popup.style.zIndex = '10000';

        const heading = document.createElement('h3');
        heading.textContent = 'Form Filler';
        popup.appendChild(heading);

        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.addEventListener('click', togglePopup);
        popup.appendChild(closeButton);

        document.body.appendChild(popup);
        popupVisible = true;
    }
}

