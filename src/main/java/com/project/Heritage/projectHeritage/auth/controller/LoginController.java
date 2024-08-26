package com.project.Heritage.projectHeritage.auth.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping(value = "/login")
public class LoginController {

    @GetMapping("/loginPage")
    public String loginPage(){
        return "user/loginPage";
    }
}
