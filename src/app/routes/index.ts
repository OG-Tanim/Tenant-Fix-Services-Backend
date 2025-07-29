import { Router } from "express";

const router = Router();

const moduleRoutes = [
  {
    path: "/auth",
    router: require("./users.routes").router,
  },
];

moduleRoutes.forEach((route) => {
  router.use(route.path, route.router);
});

export default router;
