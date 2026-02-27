const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs').promises;

class MobicardMethod2 {
    constructor(merchantId, apiKey, secretKey) {
        this.mobicardVersion = "2.0";
        this.mobicardMode = "LIVE";
        this.mobicardMerchantId = merchantId;
        this.mobicardApiKey = apiKey;
        this.mobicardSecretKey = secretKey;
        this.mobicardServiceId = "20000";
        this.mobicardServiceType = "2";
        this.mobicardExtraData = "your_custom_data_here_will_be_returned_as_is";
        
        this.mobicardTokenId = Math.floor(Math.random() * (1000000000 - 1000000 + 1)) + 1000000;
        this.mobicardTxnReference = Math.floor(Math.random() * (1000000000 - 1000000 + 1)) + 1000000;
    }

    async imageToBase64({ filePath, url, base64String }) {
        try {
            if (base64String) {
                if (base64String.includes('base64,')) {
                    return base64String.split('base64,')[1];
                }
                return base64String;
            }

            if (url) {
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                return Buffer.from(response.data, 'binary').toString('base64');
            }

            if (filePath) {
                const fileBuffer = await fs.readFile(filePath);
                return fileBuffer.toString('base64');
            }

            throw new Error('No image source provided');
        } catch (error) {
            throw new Error(`Failed to convert image: ${error.message}`);
        }
    }

    generateJWT(base64Image) {
        const jwtHeader = { typ: "JWT", alg: "HS256" };
        const encodedHeader = Buffer.from(JSON.stringify(jwtHeader)).toString('base64url');

        const jwtPayload = {
            mobicard_version: this.mobicardVersion,
            mobicard_mode: this.mobicardMode,
            mobicard_merchant_id: this.mobicardMerchantId,
            mobicard_api_key: this.mobicardApiKey,
            mobicard_service_id: this.mobicardServiceId,
            mobicard_service_type: this.mobicardServiceType,
            mobicard_token_id: this.mobicardTokenId.toString(),
            mobicard_txn_reference: this.mobicardTxnReference.toString(),
            mobicard_scan_card_photo_base64_string: base64Image,
            mobicard_extra_data: this.mobicardExtraData
        };

        const encodedPayload = Buffer.from(JSON.stringify(jwtPayload)).toString('base64url');

        const headerPayload = `${encodedHeader}.${encodedPayload}`;
        const signature = crypto.createHmac('sha256', this.mobicardSecretKey)
            .update(headerPayload)
            .digest('base64url');

        return `${encodedHeader}.${encodedPayload}.${signature}`;
    }

    async scanCard(imageSource = {}) {
        try {
            const base64Image = await this.imageToBase64(imageSource);
            const jwtToken = this.generateJWT(base64Image);

            const url = "https://mobicardsystems.com/api/v1/card_scan";
            const payload = { mobicard_auth_jwt: jwtToken };

            const response = await axios.post(url, payload, {
                httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
            });

            const responseData = response.data;

            if (responseData.status === 'SUCCESS') {
                const cardInfo = responseData.card_information || {};
                return {
                    status: 'SUCCESS',
                    cardNumber: cardInfo.card_number,
                    cardNumberMasked: cardInfo.card_number_masked,
                    cardExpiryDate: cardInfo.card_expiry_date,
                    cardBrand: cardInfo.card_brand,
                    cardBankName: cardInfo.card_bank_name,
                    cardConfidenceScore: cardInfo.card_confidence_score,
                    validationChecks: cardInfo.card_validation_checks || {},
                    rawResponse: responseData
                };
            } else {
                return {
                    status: 'ERROR',
                    statusCode: responseData.status_code,
                    statusMessage: responseData.status_message
                };
            }
        } catch (error) {
            return {
                status: 'ERROR',
                errorMessage: error.message
            };
        }
    }
}

// Usage
async function main() {
    const scanner = new MobicardMethod2(
        "4",
        "YmJkOGY0OTZhMTU2ZjVjYTIyYzFhZGQyOWRiMmZjMmE2ZWU3NGIxZWM3ZTBiZSJ9",
        "NjIwYzEyMDRjNjNjMTdkZTZkMjZhOWNiYjIxNzI2NDQwYzVmNWNiMzRhMzBjYSJ9"
    );

    const result = await scanner.scanCard({
        url: 'https://mobicardsystems.com/scan_card_photo_one.jpg'
    });

    if (result.status === 'SUCCESS') {
        console.log("Scan Successful!");
        console.log(`Card Number: ${result.cardNumberMasked}`);
        console.log(`Expiry Date: ${result.cardExpiryDate}`);
        console.log(`Card Brand: ${result.cardBrand}`);
        console.log(`Bank: ${result.cardBankName}`);
        console.log(`Confidence Score: ${result.cardConfidenceScore}`);

        if (result.validationChecks.luhn_algorithm) {
            console.log("✓ Luhn Algorithm Check Passed");
        }
        if (result.validationChecks.expiry_date) {
            console.log("✓ Expiry Date is Valid");
        } else {
            console.log("⚠ Expired or Invalid Expiry Date");
        }
    } else {
        console.log(`Scan Failed: ${result.statusMessage}`);
    }
}

// Run the example
main();
