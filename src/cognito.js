export async function login(username, password) {
  console.log(window.AmazonCognitoIdentity);
  const { CognitoUserPool, CognitoUser, AuthenticationDetails } = window.AmazonCognitoIdentity;
  const authenticationData = { Username: username, Password: password };
  const authenticationDetails = new AuthenticationDetails(authenticationData);
  const config = {
    PoolData: {
      UserPoolId: "us-west-2_vOCiW3wIS",
      ClientId: "28b97sgb61m2uvf97nufgatrq5",
    },
  };
  const userPool = new CognitoUserPool(config.PoolData);
  const userData = { Username: username, Pool: userPool };
  const cognitoUser = new CognitoUser(userData);
  return new Promise((resolve, reject) => {
    cognitoUser.authenticateUser(authenticationDetails, {
      onSuccess: (result) => {
        resolve(result.idToken.jwtToken);
      },
      onFailure: (result) => {
        reject(result);
      },
    });
  });
}

export async function getObjectUrl(token, objectName) {
  try {
    const headers = { Authorization: token, "content-type": "application/json" };
    const apiUrl = "https://yze7fb27ma.execute-api.us-west-2.amazonaws.com/beta/api";
    const bucketName = "octave-cdupload-nii";
    const response = await fetch(`${apiUrl}?bucketName=${bucketName}&objectName=${objectName}`, {
      headers,
    });
    return response.text();
  } catch (e) {
    return e;
  }
}

export async function getObjectUrls(token, studyId) {
  const objectNames = {
    blank: `grapheditor/${studyId}/blank.nii.gz`,
    brain_seg: `grapheditor/${studyId}/brain_seg.nii.gz`,
    flair: `grapheditor/${studyId}/flair.nii.gz`,
    lesions_original: `grapheditor/${studyId}/lesions_original.nii.gz`,
    subtraction: `grapheditor/${studyId}/subtraction.nii.gz`,
    t1: `grapheditor/${studyId}/t1.nii.gz`,
  };
  console.log("fetching", objectNames);
  const volumeUrls = {};
  for (const [key, value] of Object.entries(objectNames)) {
    volumeUrls[key] = (await getObjectUrl(token, value)).replace(/['"]+/g, "");
    // volumeUrls[key] = 'http://localhost:5501/scans/subtraction.nii.gz';
  }
  return volumeUrls;
}

export const studyIds = [
  "ACC000905",
  "ACC000907",
  "ACC000912",
  "ACC000914",
  "ACC000915",
  "ACC000918",
  "ACC000920",
  "ACC000921",
  "ACC000924",
  "ACC000926",
  "ACC000931",
  "ACC000935",
  "ACC000938",
  "ACC000997",
  "ACC000998",
  "ACC001000",
  "ACC001004",
  "ACC001007",
  "ACC001011",
  "ACC001013",
  "ACC001026",
  "ACC001047",
  "ACC001059",
];
