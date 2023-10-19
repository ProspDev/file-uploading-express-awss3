import aws from 'aws-sdk';
import { GetObjectOutput } from 'aws-sdk/clients/s3';

export const upload = (name: string, content: Buffer) => {
    return new Promise((resolve, reject) => {
        const s3 = new aws.S3();

        const s3Params = {
            Bucket: process.env.S3_BUCKET as string,
            Key: name,
            ContentType: "application/pdf",
            Body: content,
            ACL: 'private'
        };
        s3.putObject(s3Params, async (err, data) => {
            if (err) {
                console.error(err);
                reject(err);
            } else {
                resolve(data)
            }
    
        });
    })
    
}

export const getFile = async (key: string): Promise<aws.S3.GetObjectOutput> => {
    return new Promise((resolve, reject) => {
        const s3 = new aws.S3();

        const s3Params = {
            Bucket: process.env.S3_BUCKET as string,
            Key: key,
    
        };
        s3.getObject(s3Params, async (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
    
        });
    })
}

