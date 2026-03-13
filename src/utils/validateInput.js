const validateInput = (inputs, inputNames) => {
  const inputLength = inputs.length;
  let errorMessage = "";

  for (var i = 0; i < inputLength; i++) {
    if (Array.isArray(inputs[i])) {
      if (inputs[i].length < 1) {
        errorMessage += errorMessage.length > 0 ? `, ${inputNames[i]} cannot be empty` : `${inputNames[i]} cannot be empty`;
      }
    } else {
      if (inputs[i] === undefined || inputs[i] === null || inputs[i] === "") {
        errorMessage += errorMessage.length > 0 ? `, ${inputNames[i]} cannot be empty` : `${inputNames[i]} cannot be empty`;
      }
    }
  }

  return errorMessage;
};

export default validateInput;