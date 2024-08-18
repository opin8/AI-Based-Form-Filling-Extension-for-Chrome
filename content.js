class FormFillerModel {
    constructor() {
        this.trainingData = {};
        this.markovChains = {};
        this.crossFieldChains = {};
        this.minOccurrencesForSuggestion = 2;
        this.loadTrainingData();
    }

    async loadTrainingData() {
        const trainingData = await retrieveDecryptedData('trainingData');
        this.trainingData = trainingData?.trainingData || {};
        this.markovChains = trainingData?.markovChains || {};
        this.crossFieldChains = trainingData?.crossFieldChains || {};
    }
    

    validatePhoneNumber(phone) {
        const phoneRegex = /^(\+48)?\d{9}$/;
        return phoneRegex.test(phone.replace(/\s+/g, ''));
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    validateFirstName(firstName) {
        const nameRegex = /^[a-zA-ZàáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžæÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ∂ð ,.'-]+$/u;
        return firstName.length >= 2 && nameRegex.test(firstName);
    }
    
    validateLastName(lastName) {
        const nameRegex = /^[a-zA-ZàáâäãåąčćęèéêëėįìíîïłńòóôöõøùúûüųūÿýżźñçčšžæÀÁÂÄÃÅĄĆČĖĘÈÉÊËÌÍÎÏĮŁŃÒÓÔÖÕØÙÚÛÜŲŪŸÝŻŹÑßÇŒÆČŠŽ∂ð ,.'-]+$/u;
        return lastName.length >= 2 && nameRegex.test(lastName);
    }

    validateZipCode(zipCode) {
        const zipRegex = /^\d{2}-\d{3}$/; // Polski format kodu pocztowego
        return zipRegex.test(zipCode);
    }

    validateAddress(address) {
        const addressRegex = /^[A-Za-z0-9\s,.'-]{3,}$/;
        return addressRegex.test(address);
    }

    validateCity(city) {
        const cityRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ\s'-]+$/;
        return city.length >= 2 && cityRegex.test(city);
    }

    updateModel(fieldName, fieldValue) {
        if (fieldValue.length <= 2) return; // Ignoruj krótkie wpisy

        // Walidacja w zależności od typu pola
        switch (fieldName) {
            case 'phone':
                if (!this.validatePhoneNumber(fieldValue)) return;
                break;
            case 'email':
                if (!this.validateEmail(fieldValue)) return;
                break;
            case 'firstName':
                if (!this.validateFirstName(fieldValue)) return;
                break;
            case 'lastName':
                if (!this.validateLastName(fieldValue)) return;
                break;
            case 'zipCode':
                if (!this.validateZipCode(fieldValue)) return;
                break;
            case 'address':
                if (!this.validateAddress(fieldValue)) return;
                break;
            case 'city':
                if (!this.validateCity(fieldValue)) return;
                break;
        }

        if (!this.trainingData[fieldName]) {
            this.trainingData[fieldName] = [];
        }
        this.trainingData[fieldName].push(fieldValue);
        this.trainingData[fieldName] = this.trainingData[fieldName].slice(-20);

        this.updateMarkovChain(fieldName);
        this.updateCrossFieldChains(fieldName, fieldValue);
        this.saveTrainingData();
    }

    async saveTrainingData() {
        const data = {
            trainingData: this.trainingData,
            markovChains: this.markovChains,
            crossFieldChains: this.crossFieldChains
        };
        await storeEncryptedData('trainingData', data);
    }

    updateMarkovChain(fieldName) {
        const data = this.trainingData[fieldName];
        if (!this.markovChains[fieldName]) {
            this.markovChains[fieldName] = {};
        }
    
        for (let i = 0; i < data.length - 1; i++) {
            const current = data[i];
            const next = data[i + 1];
            if (!this.markovChains[fieldName][current]) {
                this.markovChains[fieldName][current] = {};
            }
            if (!this.markovChains[fieldName][current][next]) {
                this.markovChains[fieldName][current][next] = 0;
            }
            this.markovChains[fieldName][current][next]++;
    
            // Limitowanie liczby powiązań do 20 ostatnich
            const keys = Object.keys(this.markovChains[fieldName][current]);
            if (keys.length > 20) {
                keys.slice(0, keys.length - 20).forEach(key => {
                    delete this.markovChains[fieldName][current][key];
                });
            }
        }
    }
    

    updateCrossFieldChains(fieldName, fieldValue) {
        const relevantFields = ['firstName', 'lastName', 'email', 'phone']; // Lista powiązanych pól
    
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
    

    generateSuggestions(fieldType) {
        let suggestions = [];
        const occurrenceMap = {};
    
        // Pobierz ostatnią wartość wprowadzaną do danego pola
        if (this.trainingData[fieldType] && this.trainingData[fieldType].length > 0) {
            const currentValue = this.trainingData[fieldType][this.trainingData[fieldType].length - 1];
    
            // Dodaj sugestie z markovChains
            if (this.markovChains[fieldType] && this.markovChains[fieldType][currentValue]) {
                const possibleNext = this.markovChains[fieldType][currentValue];
                for (const suggestion in possibleNext) {
                    const count = possibleNext[suggestion];
                    occurrenceMap[suggestion] = (occurrenceMap[suggestion] || 0) + count;
                }
            }
    
            // Dodaj wszystkie unikalne wartości z trainingData
            this.trainingData[fieldType].forEach(value => {
                if (!occurrenceMap[value]) {
                    occurrenceMap[value] = 1; // Dodaj unikalne wartości z trainingData
                }
            });
    
            // Sortuj sugestie według częstości występowania
            suggestions = Object.keys(occurrenceMap).sort((a, b) => occurrenceMap[b] - occurrenceMap[a]).slice(0, 3);
        }
    
        return suggestions;
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

function getFieldType(element) {
    if (!element || !element.tagName) return null;

    const name = (element.name || '').toLowerCase();
    const id = (element.id || '').toLowerCase();
    const className = (element.className || '').toLowerCase();

    const fieldPatterns = {
        email: /\b(email|mail|e-?mail|username|user_name|user-name|fbclc_userName)\b/i,
        username: /\b(user(name)?|login|user_name|user-name)\b/i,
        firstName: /\b(first(name)?|imie|fname|given(name)?|first_name|first-name|tbname|userfirstname)\b/i,
        lastName: /\b(last(name)?|surname|nazwisko|lname|family(name)?|last_name|last-name|tbsurname|userlastname)\b/i,
        address: /\b(address|adres|addr|tbaddress)\b/i,
        phone: /\b(phone|tel|telefon|mobile|cell(phone)?|number|numertelefonu|tbphone|tbcellphone)\b/i,
        city: /\b(city|miasto|tbcity)\b/i,
        zip: /\b(zip|postal(code)?|tbzip)\b/i
    };

    for (let [fieldType, regex] of Object.entries(fieldPatterns)) {
        if (regex.test(name) || regex.test(id) || regex.test(className)) {
            return fieldType;
        }
    }

    // Check for ASP.NET style naming
    const aspNetPattern = /(?:ctl\d+\$)?(?:\w+Content\$)?(?:ctl\d+\$)?tb(\w+)$/i;
    const aspNetMatch = name.match(aspNetPattern) || id.match(aspNetPattern);
    if (aspNetMatch) {
        const fieldName = aspNetMatch[1].toLowerCase();
        for (let [fieldType, regex] of Object.entries(fieldPatterns)) {
            if (regex.test(fieldName)) {
                return fieldType;
            }
        }
    }

    // Fallback to input type for email and tel
    if (element.type === 'email') return 'email';
    if (element.type === 'tel') return 'phone';

    return null;
}

async function handleInputBlur(event) {
    const target = event.target;
    if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;

    console.log('Blur event on element:', target.name, target.id, target.className);

    const fieldType = getFieldType(target);
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
    const fieldType = getFieldType(target);
    if (!fieldType) return;

    const suggestionBox = showSuggestions(target, fieldType);

    if (suggestionBox) {
        // Add blur event listener to the input field
        target.addEventListener('blur', function blurHandler(e) {
            // Small delay to allow for clicking on suggestion
            setTimeout(() => {
                if (suggestionBox && suggestionBox.parentNode) {
                    suggestionBox.remove();
                }
                target.removeEventListener('blur', blurHandler);
            }, 200);
        });

        // Add click event listener to the document
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
        return true; // Indicate asynchronous response
    }
    
     else if (request.action === 'getAllSuggestions') {
        formFillerModel.loadTrainingData().then(() => {
            const allSuggestions = formFillerModel.getAllSuggestions();
            sendResponse({suggestions: allSuggestions});
        });
        return true; // Indicate asynchronous response
    } else if (request.action === 'getSavedData') {
        const result = await retrieveDecryptedData('lastUsedValues') || {};
        sendResponse({ savedData: result });
        return true;
    } else if (request.action === 'getModelData') {
        sendResponse({modelData: {
            trainingData: formFillerModel.trainingData,
            markovChains: formFillerModel.markovChains
        }});
    }
    return true;
});

function fillForm(profile) {
    console.log('Received profile:', profile);

    // Get all input elements on the page
    const inputs = document.querySelectorAll('input, textarea, select');

    inputs.forEach(input => {
        const fieldType = getFieldType(input);
        if (fieldType && profile[fieldType]) {
            input.value = profile[fieldType];
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`Filled ${fieldType} with value ${profile[fieldType]}`);
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

