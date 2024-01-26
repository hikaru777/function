/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

// import {onRequest} from "firebase-functions/v2/https";
// import * as logger from "firebase-functions/logger";

import * as functions from "firebase-functions";
import * as firestore from "@google-cloud/firestore";
import * as admin from "firebase-admin";
import * as geolib from 'geolib';
// const serviceAccount = require('locationmusicshareapp-firebase-adminsdk-zfkjp-b500260b7f.json');
// Firebase Admin SDKを初期化
admin.initializeApp({
    // credential: admin.credential.cert(serviceAccount),
    // 他の初期化オプションを追加できます
  });

// Cloud Firestore trigger
exports.messagePushNotify = functions.firestore.document("data/{userId}/peoplePassingBy/{documentId}")
    .onUpdate(async (snap, context) => {
        const userId = context.params.userId;
        // Get roomId from params
        const collectionRef = admin.firestore().collection(`data/${userId}/peoplePassingBy`);
        const querySnapshot = await collectionRef.get();
        const documentCount = querySnapshot.size;

        // Notification Details
        const message: admin.messaging.Message = {
            topic: userId, // 通知を受け取るトピックをユーザーのUIDに指定
            notification: {
                title: '新しい人とすれ違いました',
                body: `残り: ${documentCount}曲`,
            },
        };


        // Get the list of device notification tokens.
        try {
            const response = await admin.messaging().send(message);
            console.log('Successfully sent message:', response);
          } catch (error) {
            console.log('Error sending message:', error);
          }
    })

exports.onCollectionUpdate = functions.firestore.document('/{collectionId}/{documentId}')
  .onUpdate(async (change, context) => {
    const documentId = context.params.documentId;
    console.log(`Updated document in collection: ${documentId}`);

    try {
        const db = admin.firestore();
        const updatedData = change.after.data();
        const updatedLocation = { latitude: updatedData.latitude, longitude: updatedData.longitude };

        const snapshot = await db.collection('data').where('hash', '>=', updatedData.hash.substring(0, 6))
        .where('hash', '<', updatedData.hash.substring(0, 6) + '\uf8ff')
        .get();

        console.log(updatedData.hash.substring(0,6));
        

        snapshot.forEach(async (doc) => {
            const data = doc.data();
            console.log(data);

            // 同じhashかつ異なるドキュメントIDを持つ場合のみ処理を実行
            if (data.uid != documentId) {
                const otherLocation = { latitude: data.latitude, longitude: data.longitude };

                // 座標の距離を計算（単位はメートル）
                const distance = geolib.getDistance(updatedLocation, otherLocation);

                // 距離が3メートル以下かどうかをチェック
                if (distance <= 5) {
                    console.log('座標は5メートル以内にあります。');
                    
                    // PeoplePassingByコレクション内にデータを追加
                    const peoplePassingByRef = db.collection('data').doc(data.uid).collection('PeoplePassingBy').doc(documentId);
                    const myPassingdata = db.collection('data').doc(documentId).collection('PeoplePassingBy').doc(data.uid);
                    //すれ違った時用ののts
                    const timestamp = firestore.Timestamp.now()

                    updatedData.createdAt = timestamp;
                    updatedData.played = false
                    await peoplePassingByRef.set(updatedData)
                    data.createdAt = timestamp;
                    data.played = false
                    await myPassingdata.set(data)

                    console.log('PeoplePassingByコレクションにデータを追加しました。');
                } else {
                    console.log('座標は5メートル以上離れています。');
                }
            }
        });

        return "処理が完了しました";
    } catch (e) {
        console.error(e);
        throw e;
    }
});


// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
