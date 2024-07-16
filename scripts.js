// import { CognitoIdentityProviderClient, AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider"; // ES Modules import


// AWS Configuration
AWS.config.region = 'us-west-2'; // e.g. us-east-1
AWS.config.credentials = new AWS.CognitoIdentityCredentials({
    IdentityPoolId: 'us-west-2:830a25a6-c3a2-40a5-8218-93faf9d6ac83', // e.g. us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
});

const cognitoUserPool = new AmazonCognitoIdentity.CognitoUserPool({
    UserPoolId: 'us-west-2_K8wlZJp5p', // e.g. us-east-1_xxxxxxxx
    ClientId: '1i6q8mhs3tv5v18m686bsri1a', // e.g. xxxxxxxxxxxxxxxxxxxxxxxxxx
});

const apiGatewayUrl = 'https://jper4a5cak.execute-api.us-east-1.amazonaws.com/dev'; // e.g. https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod

const dynamoDbTableName = 'to-do-tasks';

// DOM Elements
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const taskList = document.getElementById('taskList');
const taskForm = document.getElementById('task-form');

checkExistingJWT()

// Authentication Functions
function checkExistingJWT() {
    const cognitoUser = cognitoUserPool.getCurrentUser();
    console.log("cognitoUser: ", cognitoUser)
    if (cognitoUser != null) {
        cognitoUser.getSession((err, session) => {
            if (err) {
                console.error(err);
            } else {
                console.log('session validity: ' + session.isValid());
                console.log('session: ' + JSON.stringify(session));
                console.log('session.getIdToken().getJwtToken(): ' + session.getIdToken().getJwtToken());
                AWS.config.credentials.params.Logins = {
                    [`cognito-idp.${AWS.config.region}.amazonaws.com/${cognitoUserPool.getUserPoolId()}`]: session.getIdToken().getJwtToken()
                };


                AWS.config.credentials.refresh(err => {
                    if (err) {
                        console.error(err);
                    } else {
                        authContainer.style.display = 'none';
                        appContainer.style.display = 'block';
                        loadTasks();
                    }
                });
            }
        });

    }

}

function signUp() {
    const username = document.getElementById('signUpUsername').value;
    const email = document.getElementById('signUpEmail').value;
    const password = document.getElementById('signUpPassword').value;

    const attributeList = [];
    attributeList.push(new AmazonCognitoIdentity.CognitoUserAttribute({
        Name: 'email',
        Value: email
    }));

    cognitoUserPool.signUp(username, password, attributeList, null, (err, result) => {
        if (err) {
            alert(err.message || JSON.stringify(err));
            return;
        }
        alert('Sign up successful! Please sign in.');
    });
}

function signIn() {
    const username = document.getElementById('signInUsername').value;
    const password = document.getElementById('signInPassword').value;

    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
        Username: username,
        Password: password
    });

    const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
        Username: username,
        Pool: cognitoUserPool
    });

    cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: result => {
            AWS.config.credentials.params.Logins = {
                [`cognito-idp.${AWS.config.region}.amazonaws.com/${cognitoUserPool.getUserPoolId()}`]: result.getIdToken().getJwtToken()
            };

            AWS.config.credentials.refresh(err => {
                if (err) {
                    console.error(err);
                } else {
                    authContainer.style.display = 'none';
                    appContainer.style.display = 'block';
                    loadTasks();
                    getCurrentUserId(result);
                    console.log("AWS.config.credentials.data.identityId: ", AWS.config.credentials.data.identityId)

                }
            });

            // dev
            console.log("cognitoUser: ", cognitoUser)
        },
        onFailure: err => {
            alert(err.message || JSON.stringify(err));
        }
    });
}

// Task Functions
taskForm.addEventListener('submit', event => {
    event.preventDefault();
    const title = document.getElementById('taskTitle').value;
    const description = document.getElementById('taskDescription').value;
    const dueDate = document.getElementById('taskDueDate').value;

    const params = {
        TableName: dynamoDbTableName,
        Item: {
            taskId: AWS.util.uuid.v4(),
            userId: AWS.config.credentials.identityId,
            title,
            description,
            dueDate,
            status: 'Pending'
        }
    };

    const docClient = new AWS.DynamoDB.DocumentClient();
    docClient.put(params, (err, data) => {
        if (err) {
            console.error(err);
        } else {
            loadTasks();
        }
    });
});

function loadTasks() {
    const params = {
        TableName: dynamoDbTableName,
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'attribute_exists(taskId)',
        ExpressionAttributeValues: {
            ':userId': '24f81418-7061-70d1-64f9-cb41a2af7c41' // dev: HARD CODED!
        }
    };

    const docClient = new AWS.DynamoDB.DocumentClient();
    docClient.query(params, (err, data) => {
        if (err) {
            console.error(err);
        } else {
            console.log("dynamoDB data: ", data)
            taskList.innerHTML = '';
            data.Items.forEach(task => {
                const li = document.createElement('li');
                li.innerHTML = `
                    ${task.title} - ${task.description} (Due: ${task.dueDate})
                    <button onclick="deleteTask('${task.taskId}')">Delete</button>
                `;
                taskList.appendChild(li);
            });
        }
    });
}

function deleteTask(taskId) {
    const params = {
        TableName: dynamoDbTableName,
        Key: {
            userId: AWS.config.credentials.identityId,
            taskId
        }
    };
    console.log("params: ", params);

    const docClient = new AWS.DynamoDB.DocumentClient();
    docClient.delete(params, (err, data) => {
        if (err) {
            console.error(err);
        } else {
            loadTasks();
        }
    });
}


/* DEVELOPMENT SECTION */

// this gets mock task data from the API Gateway
// async function getData() {
//     const url = "https://jper4a5cak.execute-api.us-east-1.amazonaws.com/dev/?scope=internal";
//     try {
//       const response = await fetch(url);
//       if (!response.ok) {
//         throw new Error(`Response status: ${response.status}`);
//       }
  
//       const data = await response.json();
//       console.log("data: ", data);
//       taskList.innerHTML = '';
//       data.forEach(task => {
//           const li = document.createElement('li');
//           li.innerHTML = `
//               ${task.title} - ${task.description} (Due: ${task.dueDate})
//               <button onclick="deleteTask('${task.taskId}')">Delete</button>
//           `;
//           taskList.appendChild(li);
//       });
//     } catch (error) {
//       console.error(error.message);
//     }
//   }
//   getData();


  // This gets the user ID from the Cognito token
  async function getCurrentUserId(result) {
    try {
        const idToken = result.getIdToken().getJwtToken();
        const userInfo = parseJwt(idToken);
        const userId = userInfo.sub;
        console.log('Cognito User / Entity ID:', userId);
        return userId;
    } catch (error) {
        console.error('Error getting user ID:', error);
        return null;
    }
}

// Utility function to parse JWT token
function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}