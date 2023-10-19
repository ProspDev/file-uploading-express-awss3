import { NextFunction, Request, Response } from "express";
import { addAttachment } from "../services/attachment.service";

import dataSource from "../database";
import User from "../entities/user.entity";

import { getFile, upload } from '../utils/s3operation';
import AppError from "../utils/appError";
import Children from "../entities/child.entity";

export async function addAttachmentByAdminHandler (req: Request, res: Response, next: NextFunction) {
    try {
        req.body.userId = req.params.userId;
        next();
    } catch (error) {
        console.log(error);
        return next(new AppError(400, 'Cannot upload attachment'));
    }
}

export async function addAttachmentHandler (req: any, res: Response, next: NextFunction) {
    try {
        req.body.userId = res.locals.user.id;
        next();       
    } catch (error) {
        console.log(error);
        return next(new AppError(400, 'Cannot upload attachment'));
    }
}

export async function uploadHandler (req: any, res: Response, next: NextFunction) {
    try {
        const userId = req.body.userId;

        if (!req.files || Object.keys(req.files).length === 0) {
            return next(new AppError(400, 'No files were uploaded.'));
        }

        let attached = [];
        if(req.files.attachment.length) {
            // multiple upload
            for (const fileData of req.files.attachment) {
                const fileContent = Buffer.from(fileData.data, 'binary');
                const fileName = `${new Date().getTime()}-${fileData.name}`
        
                
                await upload(fileName, fileContent);
                
                const attachment = req.body;
                console.log(attachment);
                const fileType = attachment.childId ? 'Child' : 'User';
                const created = await addAttachment({
                    ...fileData, 
                    fileType,
                    attachmentKey: fileName,
                });
        
                await dataSource
                    .createQueryBuilder()
                    .relation(User, 'attachment')
                    .of(userId)
                    .add(created.id);
        
                if(attachment.childId) {
                    await dataSource
                        .createQueryBuilder()
                        .relation(Children, 'attachment')
                        .of(attachment.childId)
                        .add(created.id);
                }
                attached.push(created);
            }
        } else {
            const fileContent = Buffer.from(req.files.attachment.data, 'binary');
            const fileName = `${new Date().getTime()}-${req.files.attachment.name}`
    
            
            await upload(fileName, fileContent);
            
            const attachment = req.body;
            const fileType = attachment.childId ? 'Child' : 'User';
            const created = await addAttachment({
                ...attachment, 
                fileType,
                attachmentKey: fileName,
            });
    
            await dataSource
                .createQueryBuilder()
                .relation(User, 'attachment')
                .of(userId)
                .add(created.id);
    
            if(attachment.childId) {
                await dataSource
                    .createQueryBuilder()
                    .relation(Children, 'attachment')
                    .of(attachment.childId)
                    .add(created.id);
            }
            attached.push(created);
        }       


        res.status(201).send({status: true, attachment: attached});
    } catch (error) {
        console.log(error);
        return next(new AppError(400, 'Cannot upload attachment'));
    }
}


export async function downloadAttachmentHandler (req: Request, res: Response, next: NextFunction) {
    try {
        const fileKey = req.query.key as string;

        if(!fileKey) {
            return next(new AppError(404, 'No file key.'));
        }

        const file = await getFile(fileKey);

        res
            .status(200)
            .appendHeader('Access-Control-Expose-Headers', 'Content-Disposition')
            .attachment(fileKey)
            .send(file.Body);

    } catch (error) {
        console.log(error);
        return next(new AppError(400, 'Cannot download attach file'));
    }
}

