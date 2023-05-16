import express, { Express, Request, response, Response } from 'express';
import {
    AppleNotification,
    createAppleInstallation,
    createAppleNotification,
    createFcmLegacyInstallation,
    createFcmLegacyNotification,
    FcmLegacyNotification,
    NotificationHubsClient,
} from "@azure/notification-hubs";
import { DeviceInstallation, NotificationRequest } from './models/notification.model';

const app: Express = express();
const port = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


app.get('/', (req: Request, res: Response) => {
    res.sendFile('index.html', { root: '.' });
    // res.send(`
    // <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-EVSTQN3/azprG1Anm3QDgpJLIm9Nao0Yz1ztcQTwFspd3yD65VohhpuuCOmLASjC" crossorigin="anonymous">
    // <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.0.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-MrcW6ZMFYlzcLA8Nl+NtUVF0sA7MsXsP1UyJoMp4YLEuNSfAP+JcXn/tWtIaxVXM" crossorigin="anonymous"></script>
    // <div class="container">
    //     <h1 class="text-center mt-3 mb-3">LookPH UAT Web Send</h1>
    //     <div class="card">
    //         <div class="card-header">Form</div>
    //         <div class="card-body">
    //             <form method="POST" action="/notifications/push-notification" id="form">
    //                 <div class="list-group">
    //                     <label class="list-group-item">
    //                         <input class="form-check-input me-1" name="platform" type="checkbox" value="ios">
    //                         iOS
    //                     </label>
    //                     <label class="list-group-item">
    //                         <input class="form-check-input me-1" name="platform" type="checkbox" value="android">
    //                         Android
    //                     </label>
    //                 </div>         
    //                 <div class="mb-3">
    //                     <label>Title</label>
    //                     <input placeholder="Title" type="text" name="title" id="title" class="form-control" required/>
    //                 </div>
    //                 <div class="mb-3">
    //                     <label>Message</label>
    //                     <textarea placeholder="Message" name="message" id="message" class="form-control" required></textarea>
    //                 </div>
    //                 <div class="mb-3 w-100">
    //                     <input type="submit" name="submit_button" class="btn btn-primary" value="Send Push Notification" />
    //                 </div>
    //             </form>
    //         </div>
    //     </div>
    // </div>
    // <script>
    //     (function() {
    //         const form = document.querySelector('#form');
    //         const checkboxes = form.querySelectorAll('input[type=checkbox]');
    //         const checkboxLength = checkboxes.length;
    //         const firstCheckbox = checkboxLength > 0 ? checkboxes[0] : null;
        
    //         function init() {
    //             if (firstCheckbox) {
    //                 for (let i = 0; i < checkboxLength; i++) {
    //                     checkboxes[i].addEventListener('change', checkValidity);
    //                 }
        
    //                 checkValidity();
    //             }
    //         }
        
    //         function isChecked() {
    //             for (let i = 0; i < checkboxLength; i++) {
    //                 if (checkboxes[i].checked) return true;
    //             }
        
    //             return false;
    //         }
        
    //         function checkValidity() {
    //             const errorMessage = !isChecked() ? 'At least one checkbox must be selected.' : '';
    //             firstCheckbox.setCustomValidity(errorMessage);
    //         }
        
    //         init();
    //     })();
    // </script>
    // `)
});

app.listen(port, () => {
    console.log(`[Server]: I am running at http://localhost:${port}`);
});

const initNotificationHubsClient = () => {
    return new NotificationHubsClient("Endpoint=sb://notificationHubNamespace01.servicebus.windows.net/;SharedAccessKeyName=DefaultFullSharedAccessSignature;SharedAccessKey=4cKGowBBBVe4LmxuCVTmy4QEs8z1XSHqqKG3OWFhcaU=", "notificationHub01");
}

app.post('/notifications/installation', async (req: Request, res: Response) => {
    const success = await createOrUpdateInstallationAsync(req.body);
    if (success) {
        res.send('Device is successfully registered')
    } else {
        res.send('Fail')
    };
});

const createOrUpdateInstallationAsync = async (deviceInstallation: DeviceInstallation) => {
    const notificationHubClient = initNotificationHubsClient();
    if (!deviceInstallation?.installationId ||
        !deviceInstallation?.platform ||
        !deviceInstallation?.pushChannel
    ) {
        return false;
    }

    let installation;

    if (deviceInstallation.platform == 'apns') {
        installation = createAppleInstallation(deviceInstallation);
    } else if (deviceInstallation.platform == 'fcm') {
        installation = createFcmLegacyInstallation(deviceInstallation);
    } else {
        return false;
    }

    try {
        await notificationHubClient.createOrUpdateInstallation(installation);
    }
    catch
    {
        return false;
    }
    return true;
}

app.delete('/notifications/delete-installation', async (req: Request, res: Response) => {
    let installationId = req.query?.installationId as string;
    const success = await deleteInstallationByIdAsync(installationId);
    if (success) {
        res.send('Success');
    } else {
        res.send('Fail');
    }
});

const deleteInstallationByIdAsync = async (installationId: string) => {
    const notificationHubClient = initNotificationHubsClient();
    if (!installationId) {
        return false;
    }
    try {
        await notificationHubClient.deleteInstallation(installationId);
    }
    catch
    {
        return false;
    }
    return true;
}

app.post('/notifications/push-notification', (req: Request, res: Response) => {
    console.log(req.body);
    requestNotificationAsync(req.body);
    res.send('Success')
});

const requestNotificationAsync = async (notificationRequest: NotificationRequest) => {
    let notifications: any[] = [];
    let platform = [];
    if(typeof notificationRequest.platform == 'string') {
        platform = [notificationRequest.platform];
    } else {
        platform = [...notificationRequest.platform]
    }
    platform.forEach(p => {
        let messageBody = {};
        switch (p) {
            case 'ios':
                messageBody = {
                    "aps": {
                        "alert": {
                            "title": notificationRequest.title,
                            "body": notificationRequest.message
                        },
                        "sound": "default"
                    }
                }
                notifications.push(
                    createAppleNotification({
                        body: JSON.stringify(messageBody),
                        headers: {
                            "apns-priority": "10",
                            "apns-push-type": "alert",
                        },
                    })
                )
                break;
            case 'android':
                break;
                // messageBody = {
                //     "notification": {
                //         "title": notificationRequest.title,
                //         "body": notificationRequest.message
                //     }
                // }
                // notifications.push(
                //     createFcmLegacyNotification({
                //         body: JSON.stringify(messageBody),
                //     })
                // )
            default:
                break;
        }
    })

    if (notifications.length == 0) {
        return false;
    } else {
        notifications.forEach(n => sendNotification(n));
    }
}

const sendNotification = async (notification: AppleNotification | FcmLegacyNotification) => {
    // Can set enableTestSend to true for debugging purposes
    const notificationHubClient = initNotificationHubsClient();
    const result = await notificationHubClient.sendNotification(notification, { enableTestSend: false });
    console.log(`Tag List send Tracking ID: ${result.trackingId}`);
    console.log(`Tag List Correlation ID: ${result.correlationId}`);
}