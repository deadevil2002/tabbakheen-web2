import { Router, type IRouter } from "express";
import healthRouter from "./health";
import gitPushRouter from "./git-push";

const router: IRouter = Router();

router.use(healthRouter);
router.use(gitPushRouter);

export default router;
