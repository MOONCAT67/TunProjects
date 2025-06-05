const Joi = require("joi");

var options = {
  errors: {
    wrap: {
      label: "",
    },
  },
};

const registerValidation = (data) => {
  const schema = Joi.object({
    fullname: Joi.string().min(3).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    phone_number: Joi.string().pattern(/^[0-9]{8,15}$/).message("Phone number must be between 8-15 digits"),
    location: Joi.string().required(),
    profile_picture: Joi.string().allow('', null).optional()
  });

  return schema.validate(data, options);
};

const loginValidation = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
  });

  return schema.validate(data, options);
};

const updateUserValidation = (data) => {
  const schema = Joi.object({
    fullname: Joi.string().min(3).max(255).optional(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(6).optional(),
    phone_number: Joi.string().pattern(/^[0-9]{8,15}$/).message("Phone number must be between 8-15 digits").optional(),
    profile_description: Joi.string().optional(),
    skills: Joi.string().optional(),
    location: Joi.string().optional(),
    profile_picture: Joi.string().optional(),
  });

  return schema.validate(data, options);
};
const createProjectValidation = (data) => {
  const schema = Joi.object({
    title: Joi.string().required(),
    description: Joi.string().required(),
    budget: Joi.number().required(),
    deadline: Joi.date().iso().required(),
    address: Joi.string().required(),
    requiredJobs: Joi.array().items(Joi.number()).min(1).required()
  });

  return schema.validate(data, options);
};

module.exports = {
  registerValidation,
  loginValidation,
  updateUserValidation,
  createProjectValidation,
};