import express, { Request, Response, NextFunction} from 'express';
import dotenv from 'dotenv';

import cookieParser from 'cookie-parser';
import session from 'express-session';
import { TypeormStore } from 'typeorm-store';
import { Session } from './entities/session.entity';

import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';

import fileUpload from 'express-fileupload';

import cors from 'cors';
import path from 'path';

import cron from 'node-cron';

import dataSource from "./database";

import authRouter from './routes/auth.route';
import childRouter from './routes/child.route';
import plansRouter from './routes/plans.route';
import membershipRouter from './routes/membership.route';
import attachmentRouter from './routes/attachment.route';
import usersRouter from './routes/user.route';
import cardRouter from './routes/card.route';
import walletRouter from './routes/wallet.route';
import addChargeRouter from './routes/add-charge.route';
import paymentRouter from './routes/payment.route';
import noteRouter from './routes/note.route';
import loanRouter from './routes/loan.route';
import reportRouter from './routes/report.route';

import AppError from './utils/appError';
import { findUserByEmail, findUserById } from './services/user.service';
import User, { RoleEnumType, UserStatus } from './entities/user.entity';
import { PERMISSION } from './utils/type';

declare global {
    namespace Express {
        interface User {
            email: string;
            id: number;
            role: RoleEnumType;
            permission: PERMISSION;
        }
    }
}

dataSource.initialize()
    .then(async () => {
        const app = express();

        const sessionRepository = dataSource.getRepository(Session);
        
        app.use(cookieParser());
        app.use(express.json({limit: '50mb'}));
        app.use(express.urlencoded({extended: true, limit: '50mb'}));
        app.use(fileUpload());        
        
        dotenv.config();
        const port = process.env.PORT || 8007;

        app.use(cors({
            origin: '*',
            credentials: true
        }));

        app.use(session({
            secret: process.env.SESSION_SECRET || 'secure_session_token',
            resave: true,
            saveUninitialized: true,
            cookie: {
                httpOnly: true,
                maxAge: 1000 * 60 * 60 * 24 * 7,
                // secure: false,
                // sameSite: 'none'
            },
            store: new TypeormStore({repository: sessionRepository}),
        }))

        app.use(passport.initialize());
        app.use(passport.session());

        passport.serializeUser(function (user, done) {
            done(null, user.id);
        });
        
        passport.deserializeUser(function(userId: number, done: any) {
            findUserById(userId).then(user => {
                done(null, user);
            });
        });

        passport.use('local-login', new LocalStrategy({
            usernameField: 'email',
            passwordField: 'password',
            passReqToCallback: true
        }, async function (req, email, password, done) {
                const user = await findUserByEmail(email);

                if(!user) {
                    return done(null, false, { message: 'User not found' });
                }

                if(user.status !== UserStatus.APPROVED) {
                    return done(null, false, { message: 'You are not approved yet. Please contact admin.' });
                }
                
                const isCorrectPassword = await User.comparePasswords(password, user.password);
                if(!isCorrectPassword) {
                    return done(null, false, { message: 'Wrong password.' });
                }
                
                req.user = user;
                return done(null, user);
            }
        ));

        app.use(express.static(path.join(__dirname, '/frontend/dist/')));

        app.get('/', function (req, res) {
            res.sendFile(__dirname + '/frontend/dist/index.html');
        });

        app.get('/auth/**', function (req, res) {
            res.sendFile(__dirname + '/frontend/dist/index.html');
        })

        app.get('/admin', function (req, res) {
            res.sendFile(__dirname + '/frontend/dist/index.html');
        });

        app.get('/admin/**', function (req, res) {
            res.sendFile(__dirname + '/frontend/dist/index.html');
        });

        app.get('/me/**', function (req, res) {
            res.sendFile(__dirname + '/frontend/dist/index.html');
        })

        // Routes
        app.use('/api/auth', authRouter);
        app.use('/api/plans', plansRouter);
        app.use('/api/child', childRouter);
        app.use('/api/membership', membershipRouter);
        app.use('/api/attachment', attachmentRouter);
        app.use('/api/user', usersRouter);
        app.use('/api/card', cardRouter);
        app.use('/api/wallet', walletRouter);
        app.use('/api/add-charge', addChargeRouter);
        app.use('/api/payment', paymentRouter);
        app.use('/api/note', noteRouter);
        app.use('/api/loan', loanRouter);
        app.use('/api/report', reportRouter);
        
        // UNHANDLED ROUTE
        // app.all('*', (req: Request, res: Response, next: NextFunction) => {
        //     next(new AppError(404, `Route ${req.originalUrl} not found`));
        // });

        // GLOBAL ERROR HANDLER
        app.use(
            (error: AppError, _req: Request, res: Response, next: NextFunction) => {
            error.status = error.status || 'error';
            error.statusCode = error.statusCode || 500;

            res.status(error.statusCode).json({
                status: error.status,
                message: error.message,
            });
            }
        );

        // run cron 
        // cron.schedule('0 * * * * *', generatePaymentsRecords);

        app.listen(port, async () => {
            console.log(`App is listening`);
        })
    })