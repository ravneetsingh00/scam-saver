const mongoose=require('mongoose');
const schema=new mongoose.Schema({name:{type:String,required:true,trim:true,maxlength:120},ownerName:{type:String,trim:true,default:''},category:{type:String,required:true,trim:true},location:{type:String,required:true,trim:true},description:{type:String,trim:true,default:''},isDemo:{type:Boolean,default:false}},{timestamps:true});
schema.index({name:'text',ownerName:'text',category:'text',location:'text'});
module.exports=mongoose.model('Business',schema);
