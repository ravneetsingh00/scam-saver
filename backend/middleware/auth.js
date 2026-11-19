const jwt=require('jsonwebtoken');const User=require('../models/User');
async function protect(req,res,next){try{const h=req.headers.authorization;if(!h?.startsWith('Bearer '))return res.status(401).json({message:'Sign in to continue.'});const decoded=jwt.verify(h.slice(7),process.env.JWT_SECRET);req.user=await User.findById(decoded.id);if(!req.user)return res.status(401).json({message:'Account not found.'});next();}catch(e){res.status(401).json({message:'Session expired. Please sign in again.'});}}
function adminOnly(req,res,next){if(req.user?.role!=='admin')return res.status(403).json({message:'Administrator access required.'});next();}
module.exports={protect,adminOnly};
