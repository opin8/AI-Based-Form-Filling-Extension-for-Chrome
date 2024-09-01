function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePhoneNumber(phone) {
    const phoneRegex = /^(\+48)?\d{9}$/;
    return phoneRegex.test(phone.replace(/\s+/g, ''));
}

function validateFirstName(firstName) {
    const firstNameRegex = /^([ \u00c0-\u01ffa-zA-Z'\-])+$/;
    return firstName.length >= 2 && firstNameRegex.test(firstName);
}

function validateLastName(lastName) {
    const lastNameRegex = /^([ \u00c0-\u01ffa-zA-Z'\-])+$/;
    return lastName.length >= 2 && lastNameRegex.test(lastName);
}

function validateAddress(address) {
    const addressRegex = /^([ \u00c0-\u01ffa-zA-Z0-9'\/\-])+$/;
    return addressRegex.test(address);
}

function validateCity(city) {
    const cityRegex = /^([ \u00c0-\u01ffa-zA-Z'\-])+$/u;
    return city.length >= 2 && cityRegex.test(city);
}

function validateZipCode(zipCode) {
    const zipRegex = /^\d{2}-\d{3}$/;
    return zipRegex.test(zipCode);
}
